import { readFileSync, writeFileSync } from "node:fs";

// Карточка превью 1200×630 — то, что видит человек, когда ссылку на сайт
// кидают в мессенджер или соцсеть.
//
// Собрана из того, что у сайта уже есть: знак, фирменный узор и первая
// строка главной. Новой фирменной графики здесь не рисуется — это работа
// заказчика, а не вёрстки.
//
// Слово «VEDAL» набрано, а не взято картинкой: в присланных файлах оно
// чёрное и на тёмной подложке не читается вовсе.

const src = readFileSync("content/pattern-shapes.ts", "utf8");
const формы = {};
for (const m of src.matchAll(/"([\w-]+)": \{ w: ([\d.]+), h: ([\d.]+), d: "([^"]+)" \}/g)) {
  формы[m[1]] = { w: +m[2], h: +m[3], d: m[4] };
}

const знак = readFileSync("public/brand/vedal-cross.png").toString("base64");
const шрифтЗаголовка = readFileSync("app/fonts/Unbounded.woff2", "base64");
const шрифтТекста = readFileSync("app/fonts/Commissioner.woff2", "base64");

// Узор держится правой стороны: слева текст, и композиция уравновешивает
// его, а не спорит с ним.
const места = [
  { id: "p2-1", x: 1010, y: 40, h: 470, ink: "pale" },
  { id: "p1-1", x: 700, y: 250, h: 430, ink: "pale" },
  { id: "p1-2", x: 880, y: -40, h: 300, ink: "deep" },
  { id: "p1-sq-1", x: 920, y: 300, h: 160, ink: "accent" },
  { id: "p2-sq-1", x: 1090, y: 480, h: 120, ink: "accent" },
  { id: "p1-sq-2", x: 830, y: 470, h: 66, ink: "accent" },
  { id: "p1-3", x: 1120, y: 250, h: 100, ink: "deep" },
  { id: "p1-sq-4", x: 1010, y: 180, h: 50, ink: "accent" },
  { id: "p2-3", x: 780, y: 120, h: 110, ink: "pale" },
  { id: "p1-sq-7", x: 880, y: 240, h: 32, ink: "accent" },
];

const краски = { pale: "rgba(255,255,255,0.07)", deep: "rgba(255,255,255,0.13)", accent: "#22B84A" };
const фигуры = места
  .map((м) => {
    const f = формы[м.id];
    const k = м.h / f.h;
    return `<g transform="translate(${м.x} ${м.y}) scale(${k.toFixed(3)})" fill="${краски[м.ink]}"><path d="${f.d}" fill-rule="evenodd"/></g>`;
  })
  .join("");

const html = `<!doctype html><meta charset="utf-8"><style>
  @font-face { font-family: Unbounded; src: url("data:font/woff2;base64,${шрифтЗаголовка}") format("woff2") }
  @font-face { font-family: Commissioner; src: url("data:font/woff2;base64,${шрифтТекста}") format("woff2") }
  * { margin: 0; box-sizing: border-box }
  body { width: 1200px; height: 630px; overflow: hidden; background: #0E2A1B; position: relative;
         font-family: Commissioner, system-ui; color: #fff }
  svg.uzor { position: absolute; inset: 0 }
  .content { position: relative; padding: 66px 76px; height: 100%; display: flex;
             flex-direction: column; justify-content: space-between }
  .brand { display: flex; align-items: center; gap: 16px }
  .brand img { height: 56px; width: auto }
  .brand span { font-family: Unbounded, system-ui; font-weight: 600; font-size: 34px; letter-spacing: 0.02em }
  h1 { font-family: Unbounded, system-ui; font-weight: 500; font-size: 60px; line-height: 1.07;
       letter-spacing: -0.03em; max-width: 14ch }
  .lead { margin-top: 20px; font-size: 23px; line-height: 1.45; color: rgba(255,255,255,0.72); max-width: 30ch }
  .foot { display: flex; align-items: baseline; gap: 22px; font-size: 20px; color: rgba(255,255,255,0.6) }
  .foot b { color: #fff; font-weight: 600; font-size: 22px }
</style>
<svg class="uzor" viewBox="0 0 1200 630" width="1200" height="630">${фигуры}</svg>
<div class="content">
  <div class="brand"><img src="data:image/png;base64,${знак}" alt=""><span>VEDAL</span></div>
  <div>
    <h1>Медицинское оборудование, сделанное в России</h1>
    <p class="lead">Инкубаторы, реанимационные системы и терморегуляция для неонатологии и реанимации</p>
  </div>
  <div class="foot"><b>vedal-med.ru</b><span>Екатеринбург · собственное производство</span></div>
</div>`;

writeFileSync(process.argv[2] + "/og.html", html);
console.log("карточка пересобрана");
