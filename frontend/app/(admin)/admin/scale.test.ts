import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Сторож шкалы админки.
//
// Двадцать два кегля, тридцать четыре отступа и четыре скругления набрались
// не разом, а по одному: каждое отдельное «тут на два пикселя побольше»
// выглядит безобидно. Поэтому считает сборка, а не внимание.

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(p);
    return p.endsWith(".tsx") && !p.includes(".test.") ? [p] : [];
  });
}

const css = readFileSync(join("app", "(admin)", "admin", "admin.css"), "utf8");

/** Значения свойства во всех правилах файла: "padding: 12px 0" → ["12px", "0"]. */
function values(property: string): { rule: string; parts: string[] }[] {
  const found: { rule: string; parts: string[] }[] = [];
  const re = new RegExp("(?:^|[;{ ])(" + property + "):[ ]*([^;{}]+);", "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) found.push({ rule: m[0].trim(), parts: m[2].trim().split(/[ ]+/) });
  return found;
}

describe("шкала админки", () => {
  it("кегль задаётся токеном, а не числом", () => {
    // clamp() допустим, но его границы — тоже токены.
    const raw = values("font-size")
      .filter((v) => !v.rule.includes("var(--t-"))
      .map((v) => v.rule);

    expect(raw, "используйте --t-micro … --t-h1").toEqual([]);
  });

  it("отступы кратны четырём", () => {
    const off: string[] = [];
    for (const property of ["padding", "margin", "gap", "row-gap", "column-gap"]) {
      for (const { rule, parts } of values(property)) {
        for (const part of parts) {
          const m = part.match(/^([0-9.]+)px$/);
          if (!m) continue;
          const px = parseFloat(m[1]);
          // 1px — это волосяная линия, а не отступ.
          if (px <= 1) continue;
          if (px % 4 !== 0) off.push(rule);
        }
      }
    }

    expect([...new Set(off)], "шкала отступов: 4, 8, 12, 16, 20, 24, 32, 40, 48").toEqual([]);
  });

  it("скругления — только пара, которой набран сайт", () => {
    // 3px у карточек, 2px у кнопок и полей: замер по сайту даёт 33 и 30
    // вхождений соответственно. Свести к одному значило бы развести
    // админку с сайтом, а оболочка строилась ровно наоборот.
    const off = values("border-radius")
      .filter(({ parts }) => !parts.some((p) => p.includes("var(--radius-") || p.includes("50%")))
      .map((v) => v.rule);

    expect(off, "используйте --radius-card или --radius-control").toEqual([]);
  });

  it("у рабочей поверхности задан базовый кегль", () => {
    // Без него всё без явного кегля падает на браузерные 16px — размер,
    // которого в шкале нет. На экране входа так набралось четыре обёртки.
    expect(css).toMatch(/\.admin-body \{[^}]*font-size: var\(--t-base\)/);
  });
  // Инлайновые стили в разметке — отдельная история: пока они там есть,
  // числа в них обязаны быть теми же токенами. Иначе шкала держится только
  // в таблице стилей, а треть оформления живёт мимо неё, как и было до правки.
  it("в разметке нет чисел вместо токенов", () => {
    const files = tsxFiles(join("app", "(admin)"));
    const guilty: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const m of source.matchAll(/(fontSize|borderRadius|margin[A-Z][a-z]+|padding[A-Z]*[a-z]*|gap):[ ]*([0-9.]+)/g)) {
        if (m[2] === "0") continue;
        guilty.push(file.split(/[\/]/).slice(-2).join("/") + "  " + m[0]);
      }
    }

    expect([...new Set(guilty)], "используйте var(--t-*) и var(--s*)").toEqual([]);
  });
});
