// Сборка страницы «Шрифты и знаки VEDAL» — два варианта заголовочного шрифта
// на согласование заказчику (§11.4 плана от 18 августа 2026).
//
// Запуск из корня репозитория:
//   node outputs/typography_variants/build.mjs
// Результат: outputs/typography_variants/typography_variants.html
//
// ————— почему шрифты вшиваются в файл —————
//
// Страница уходит заказчику ссылкой и открывается там, где нашего сервера
// нет. Ссылка на CDN означала бы, что через месяц страница откроется другим
// шрифтом или без него, и сравнение, ради которого она сделана, перестанет
// работать. Base64 весит около мегабайта — цена того, что документ
// самодостаточен.
//
// Onest в репозитории не лежит: он нужен только этой странице, и тащить
// в сайт шрифт, который ещё не выбран, незачем. Скрипт скачивает его
// из google/fonts (OFL) при сборке.

import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const root = path.resolve(here, "..", "..");
const fonts = path.join(root, "frontend", "app", "fonts");

const ONEST_URL =
  "https://raw.githubusercontent.com/google/fonts/main/ofl/onest/Onest%5Bwght%5D.ttf";
const onestFile = path.join(here, "Onest.ttf");

if (!fs.existsSync(onestFile)) {
  console.log("Качаю Onest…");
  const res = await fetch(ONEST_URL);
  if (!res.ok) throw new Error(`Onest не скачался: ${res.status}`);
  fs.writeFileSync(onestFile, Buffer.from(await res.arrayBuffer()));
}

const b64 = (file) => fs.readFileSync(file).toString("base64");

const html = fs
  .readFileSync(path.join(here, "typography_variants.src.html"), "utf8")
  .replace("__UNBOUNDED__", b64(path.join(fonts, "Unbounded.woff2")))
  .replace("__COMMISSIONER__", b64(path.join(fonts, "Commissioner.woff2")))
  .replace("__MONO__", b64(path.join(fonts, "JetBrainsMono.woff2")))
  .replace("__ONEST__", b64(onestFile));

if (/__[A-Z]+__/.test(html)) throw new Error("в шаблоне остался незаменённый ключ");

const out = path.join(here, "typography_variants.html");
fs.writeFileSync(out, html);
console.log(`Готово: ${out}, ${Math.round(html.length / 1024)} КБ`);
