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
//
// Скрипт кладёт разметку карточки в указанный каталог, снимок с неё делает
// браузер — своего рисовальщика в проекте нет и заводить его ради одной
// картинки не стоит:
//
//   node scripts/build-og-cover.mjs <каталог>
//   chrome --headless --disable-gpu --hide-scrollbars \
//     --force-prefers-reduced-motion --window-size=1200,630 \
//     --virtual-time-budget=8000 \
//     --screenshot=public/brand/og-cover.png file://<каталог>/og.html
//
// Узор в карточке берётся из content/pattern-shapes.ts — перерисовали формы,
// пересоберите и карточку, иначе она останется с прежними.

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
//
// Фигур намеренно мало и они крупные. Прошлая раскладка была из десяти, они
// лезли друг на друга и обрезались краем — на превью в ленте, где карточка
// шириной в пол-экрана, это читалось не узором, а сором по углу. Здесь
// семь фигур: одна большая ветка держит правый край, вторая — верх,
// остальное точки. Между всеми — воздух, ни одна не выходит за поле.
const ПОЛЕ = { w: 1200, h: 630 };
/** Левее этого — текст. Узор туда не заходит. */
const ТЕКСТ_ДО = 860;
/** Меньше этого зазора две фигуры читаются как одна слипшаяся. */
const ЗАЗОР = 20;
/** Ближе этого к краю фигура выглядит обрезанной, даже если целая. */
const ОТСТУП = 20;

const места = [
  { id: "p2-1", x: 890, y: 90, h: 350, ink: "pale" },
  { id: "p1-sq-2", x: 1120, y: 70, h: 52, ink: "accent" },
  { id: "p1-sq-7", x: 1130, y: 390, h: 26, ink: "accent" },
  { id: "p1-3", x: 880, y: 470, h: 90, ink: "deep" },
  { id: "p1-sq-1", x: 1040, y: 470, h: 120, ink: "accent" },
];

// Раскладка проверяется, а не разглядывается: на снимке карточки слипшиеся
// на пару пунктов фигуры и срез по краю видно плохо, а в ленте — хорошо.
const коробки = места.map((м) => {
  const f = формы[м.id];
  return { ...м, w: (м.h * f.w) / f.h };
});
const жалобы = [];
for (const к of коробки) {
  if (к.x < ТЕКСТ_ДО) жалобы.push(`${к.id} заходит на текст (x ${к.x})`);
  if (к.x + к.w > ПОЛЕ.w - ОТСТУП || к.y + к.h > ПОЛЕ.h - ОТСТУП || к.y < ОТСТУП) {
    жалобы.push(`${к.id} жмётся к краю поля (${Math.round(к.x)},${Math.round(к.y)} + ${Math.round(к.w)}×${к.h})`);
  }
}
for (let i = 0; i < коробки.length; i += 1) {
  for (let j = i + 1; j < коробки.length; j += 1) {
    const a = коробки[i];
    const b = коробки[j];
    const поX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const поY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    const зазор = Math.max(-поX, -поY);
    if (зазор < ЗАЗОР) жалобы.push(`${a.id} и ${b.id} — зазор ${Math.round(зазор)}`);
  }
}
if (жалобы.length) {
  console.error("раскладка узора:\n  " + жалобы.join("\n  "));
  process.exit(1);
}

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
  .eyebrow { font-size: 22px; color: #29D35D; margin-bottom: 18px; letter-spacing: 0.16em; text-transform: uppercase }
  h1 { font-family: Unbounded, system-ui; font-weight: 500; font-size: 58px; line-height: 1.08;
       max-width: 15ch }
  .lead { margin-top: 22px; font-size: 24px; line-height: 1.42; color: rgba(255,255,255,0.76); max-width: 34ch }
  .foot { display: flex; align-items: baseline; gap: 22px; font-size: 20px; color: rgba(255,255,255,0.6) }
  .foot b { color: #fff; font-weight: 600; font-size: 22px }
</style>
<svg class="uzor" viewBox="0 0 1200 630" width="1200" height="630">${фигуры}</svg>
<div class="content">
  <div class="brand"><img src="data:image/png;base64,${знак}" alt=""><span>VEDAL</span></div>
  <div>
    <p class="eyebrow">Официальный сайт</p>
    <h1>Медицинское оборудование VEDAL</h1>
    <p class="lead">Инкубаторы, реанимационные системы и терморегуляция для неонатологии, реанимации и интенсивной терапии</p>
  </div>
  <div class="foot"><b>vedal-med.ru</b><span>Екатеринбург · собственное производство</span></div>
</div>`;

writeFileSync(process.argv[2] + "/og.html", html);
console.log("карточка пересобрана");
