import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Сторож подписей.
//
// Замер на живых экранах: двадцать четыре поля и списка были без имени
// вовсе. Глазами всё понятно — рядом стоит заголовок колонки или соседнее
// поле, — а дереву доступности не сообщается ничего: фильтр статуса
// объявлялся как «все статусы», то есть своим текущим значением.
// Placeholder именем работает только пока поле пустое, а как раз при
// заполнении подпись и нужна.

const root = join("app", "(admin)");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(p);
    return p.endsWith(".tsx") && !p.includes(".test.") ? [p] : [];
  });
}

/** Открывающий тег целиком: атрибуты бывают на нескольких строках. */
function openingTags(source: string): { tag: string; at: number }[] {
  const found: { tag: string; at: number }[] = [];
  const re = /<(select|input|textarea)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    let depth = 0;
    let end = m.index;
    for (let i = m.index; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0) { end = i; break; }
    }
    found.push({ tag: source.slice(m.index, end + 1), at: m.index });
  }
  return found;
}

describe("подписи полей в админке", () => {
  it("у каждого поля есть имя", () => {
    const безымянные: string[] = [];

    for (const file of tsxFiles(root)) {
      const source = readFileSync(file, "utf8");
      const lines = source.split("\n");

      for (const { tag, at } of openingTags(source)) {
        if (tag.includes('type="hidden"')) continue;
        if (tag.includes("aria-label") || tag.includes("aria-labelledby")) continue;

        // Обёртка Field или label подписывает вложенное поле сама.
        const line = source.slice(0, at).split("\n").length;
        const выше = lines.slice(Math.max(0, line - 11), line).join(" ");
        if (/<Field\b|<label\b/.test(выше)) continue;

        безымянные.push(file + ":" + line + "  " + tag.replace(/\s+/g, " ").slice(0, 56));
      }
    }

    expect(безымянные, "добавьте aria-label или оберните в <Field>").toEqual([]);
  });
});
