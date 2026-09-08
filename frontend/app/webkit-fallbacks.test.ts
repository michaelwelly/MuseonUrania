import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Сторож запасных объявлений для WebKit.
//
// Safari отбрасывает объявление целиком, если не понимает хоть одну его часть.
// Ошибки при этом нет ни в консоли, ни в сборке: свойство просто не
// применяется, и вёрстка едет только на маке и только у того, кто не обновил
// систему. Поймать это глазами с Windows нечем — поэтому считает сборка.
//
// Правило простое: строка с современным значением идёт второй, а первой стоит
// та же строка со значением, которое понимают все. Chromium читает вторую,
// старый Safari — первую. Тест следит, чтобы первую не потеряли при правке
// и чтобы она не разошлась с палитрой.

const root = import.meta.dirname ? join(import.meta.dirname, "..") : ".";

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.name === "node_modules" || entry.name === ".next") return [];
    if (entry.isDirectory()) return cssFiles(path);
    return path.endsWith(".css") ? [path] : [];
  });
}

type Line = { file: string; no: number; text: string };

// Комментарии выбиваются пробелами, а не выбрасываются: номера строк должны
// остаться настоящими, иначе в сообщении об ошибке будет некуда смотреть.
// Половинчатая чистка здесь уже подводила — строку «rgba(...); /* запас */»
// первая версия теста считала комментарием и не находила запас, который
// стоял прямо перед ней.
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (found) => found.replace(/[^\n]/g, " "));
}

function lines(): Line[] {
  const found: Line[] = [];
  for (const file of [...cssFiles(join(root, "app")), ...cssFiles(join(root, "components"))]) {
    const name = file.slice(root.length + 1);
    withoutComments(readFileSync(file, "utf8"))
      .split(/\r?\n/)
      .forEach((text, index) => found.push({ file: name, no: index + 1, text }));
  }
  return found;
}

// Предыдущее объявление. Пустые строки пропускаем: запас положено подписывать
// комментарием, а комментарии к этому месту уже стали пустыми строками.
function previousDeclaration(all: Line[], at: number): string {
  for (let i = at - 1; i >= 0; i -= 1) {
    const text = all[i].text.trim();
    if (!text) continue;
    return text;
  }
  return "";
}

function tokenRgb(name: string): [number, number, number] {
  const globals = readFileSync(join(root, "app", "globals.css"), "utf8");
  const found = globals.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!found) throw new Error(`токен ${name} пропал из globals.css`);
  const hex = found[1];
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

describe("запасные объявления для WebKit", () => {
  const all = lines();

  // color-mix() появился в Safari 16.2 (декабрь 2022). До неё объявление
  // с ним невалидно, и элемент остаётся без фона вовсе.
  //
  // color-mix(in srgb, C p%, transparent) тождественно rgba(C, p/100), поэтому
  // запас не приблизительный. Но var() внутрь rgba() не подставить, числа
  // приходится разворачивать руками — а значит они могут разойтись с токеном
  // при первой же правке палитры. Здесь и ловим.
  it("у каждого color-mix впереди стоит точный rgba из того же токена", () => {
    const pattern = /^([\w-]+):\s*color-mix\(in srgb,\s*var\((--[\w-]+)\)\s*([\d.]+)%,\s*transparent\)/;
    const broken: string[] = [];

    all.forEach((line, index) => {
      const found = line.text.trim().match(pattern);
      if (!found) return;
      const [, property, token, share] = found;
      const [r, g, b] = tokenRgb(token);
      const alpha = Number(share) / 100;
      const want = `${property}: rgba(${r}, ${g}, ${b}, ${alpha});`;
      const got = previousDeclaration(all, index);
      if (!got.startsWith(want)) {
        broken.push(`${line.file}:${line.no}  нужно «${want}», стоит «${got || "ничего"}»`);
      }
    });

    expect(broken, "перед строкой с color-mix обязан стоять её точный запас").toEqual([]);
  });

  // Единицы svh/dvh/lvh появились в Safari 15.4 (март 2022). До неё объявление
  // отбрасывается, и высоты не остаётся вовсе: окно чата вырастает за экран,
  // подвал поднимается к содержимому.
  it("у каждой svh/dvh впереди стоит то же свойство в vh", () => {
    const broken: string[] = [];

    all.forEach((line, index) => {
      const text = line.text.trim();
      const found = text.match(/^([\w-]+):/);
      if (!found || !/\d(svh|dvh|lvh)\b/.test(text)) return;
      const property = found[1];
      const got = previousDeclaration(all, index);
      const ok = got.startsWith(`${property}:`) && /\d vh\b|\dvh\b/.test(got) && !/\d(svh|dvh|lvh)\b/.test(got);
      if (!ok) {
        broken.push(`${line.file}:${line.no}  ${text} — впереди «${got || "ничего"}»`);
      }
    });

    expect(broken, "перед строкой с svh/dvh обязана стоять та же строка в vh").toEqual([]);
  });

  // Значение clip у overflow — Safari 16.0. Здесь оно стоит на html и body
  // намеренно вместо hidden: hidden сделал бы из них скролл-контейнер и убил
  // position: sticky у шапки. В старом Safari объявление отбрасывается,
  // подрезки нет вовсе, и страница ездит вбок — запас обязателен.
  it("у overflow: clip есть запас через @supports", () => {
    const globals = withoutComments(readFileSync(join(root, "app", "globals.css"), "utf8"));
    const usesClip = all.some((line) => /^overflow(-x|-y)?:\s*clip;/.test(line.text.trim()));

    expect(usesClip, "правило про clip описывает globals.css — проверка потеряла предмет").toBe(true);
    expect(globals).toMatch(/@supports not \(overflow: clip\)/);
  });

  // Всё, что проверено выше, живёт в исходниках, а до браузера доезжает сборка.
  // Lightning CSS внутри Next выбрасывает из готового файла запасы и префиксы,
  // которые считает лишними для целевых браузеров, — и без .browserslistrc
  // цели у него «свежие браузеры». Тогда проверки выше проходят, а в
  // chunks/*.css запасов нет: правильные исходники и сломанная выдача.
  // Поэтому целевой список — часть починки, а не настройка вкуса.
  it("список целевых браузеров задан и опускается до Safari 15", () => {
    const config = readFileSync(join(root, ".browserslistrc"), "utf8");
    const floor = config.match(/^\s*safari\s*>=\s*(\d+(?:\.\d+)?)\s*$/m);

    expect(floor, ".browserslistrc обязан называть нижнюю границу Safari").not.toBeNull();
    expect(Number(floor?.[1]), "ниже Safari 16 запасы нужны, выше — их выбросит сборка")
      .toBeLessThanOrEqual(15);

    // Два источника целей одновременно browserslist не читает — он падает.
    // Ловим это здесь, а не на сборке образа.
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.browserslist, "цели заданы в .browserslistrc, в package.json их быть не должно")
      .toBeUndefined();
  });
});
