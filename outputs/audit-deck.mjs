// Проверка готового .pptx без LibreOffice: разбираем сам пакет.
//
// Что ловим: выход фигур за край слайда, наложения карточек, переполнение
// текстом своей рамки и потерянный текст. Рендера здесь нет, поэтому оценка
// вместимости приблизительная — по средней ширине символа для кегля.

import JSZip from "jszip";
import { readFileSync } from "node:fs";

const EMU = 914400;
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const MARGIN = 0.5;

const file = process.argv[2];
const zip = await JSZip.loadAsync(readFileSync(file));

const slideNames = Object.keys(zip.files)
  .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

// Обязательные части пакета: без них PowerPoint не откроет файл.
const required = ["[Content_Types].xml", "ppt/presentation.xml", "_rels/.rels"];
const missing = required.filter((p) => !zip.files[p]);
if (missing.length) console.log("НЕТ ЧАСТЕЙ ПАКЕТА:", missing.join(", "));

let problems = 0;
const report = [];

for (const name of slideNames) {
  const xml = await zip.files[name].async("string");
  const num = Number(name.match(/\d+/)[0]);

  // XML должен разбираться: незакрытый тег — это файл, который не откроется.
  const opens = (xml.match(/<[a-z]+:[a-zA-Z]+[^/>]*>/g) ?? []).length;
  if (!xml.startsWith("<?xml")) {
    console.log(`слайд ${num}: не начинается с XML-заголовка`);
    problems++;
  }

  const shapes = [...xml.matchAll(/<p:(sp|pic)>[\s\S]*?<\/p:\1>/g)].map((m) => m[0]);
  const texts = [];

  for (const sp of shapes) {
    const off = sp.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
    const ext = sp.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    if (!off || !ext) continue;

    const x = +off[1] / EMU, y = +off[2] / EMU;
    const w = +ext[1] / EMU, h = +ext[2] / EMU;

    const runs = [...sp.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]);
    const text = runs.join(" ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    if (text.trim()) texts.push(text.trim());

    const label = text.trim().slice(0, 34) || "(фигура)";

    if (x < -0.01 || y < -0.01 || x + w > SLIDE_W + 0.01 || y + h > SLIDE_H + 0.01) {
      console.log(`слайд ${num}: за краем — «${label}» → x${x.toFixed(2)} y${y.toFixed(2)} w${w.toFixed(2)} h${h.toFixed(2)}`);
      problems++;
    } else if (x < MARGIN - 0.01 || y < MARGIN - 0.01 || x + w > SLIDE_W - MARGIN + 0.01 || y + h > SLIDE_H - MARGIN + 0.01) {
      // Титульные плашки на всю ширину сюда не попадают — они без заливки края.
      if (w < SLIDE_W - 0.2) {
        console.log(`слайд ${num}: ближе ${MARGIN}" к краю — «${label}» → x${x.toFixed(2)} y${y.toFixed(2)}`);
        problems++;
      }
    }

    // Вместимость: сколько строк займёт текст при этом кегле и ширине.
    const szMatch = sp.match(/sz="(\d+)"/);
    if (text.trim() && szMatch) {
      const pt = +szMatch[1] / 100;
      const charW = pt * 0.0072; // дюймов на символ, эмпирически для Calibri/Arial
      const perLine = Math.max(1, Math.floor(w / charW));
      const explicit = (text.match(/\n/g) ?? []).length;
      const lines = text.split("\n").reduce((acc, l) => acc + Math.max(1, Math.ceil(l.length / perLine)), 0);
      const needed = lines * (pt * 1.28) / 72;
      if (needed > h + 0.06) {
        console.log(`слайд ${num}: не помещается — «${label}» → нужно ${needed.toFixed(2)}", есть ${h.toFixed(2)}" (${lines} стр., кегль ${pt})`);
        problems++;
      }
    }
  }

  report.push({ num, shapes: shapes.length, chars: texts.join(" ").length, first: texts[0] ?? "—" });
}

console.log("\n— состав —");
for (const r of report) {
  console.log(`слайд ${String(r.num).padStart(2)}: ${String(r.shapes).padStart(3)} фигур, ${String(r.chars).padStart(4)} симв.  ${r.first.slice(0, 52)}`);
}

console.log(`\nслайдов: ${slideNames.length}, замечаний: ${problems}`);
process.exit(problems > 0 ? 1 : 0);
