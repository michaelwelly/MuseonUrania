import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEAD_SOURCE } from "./labels";

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

// Источник заявки.
//
// Набор замкнут ограничением схемы `lead_source_check`, и оно уже
// переписывалось: V5 завела три значения, V30 добавила `chat`. Карта подписей
// про это не узнала, и заявка из разговора с Ведалиной показывалась сырым
// «chat» — в списке заявок, на карточке и в аналитике, в русской таблице
// рядом со словом «сайт» (issue #99).
//
// Сторож здесь простой и намеренно не читает миграцию: тесты фронта не должны
// зависеть от того, лежит ли рядом дерево бэкенда. Он держит список, который
// надо править вместе со схемой, — и падает, если кто-то уберёт значение,
// а не только если забудет добавить.
describe("источник заявки", () => {
  it("у каждого значения схемы есть русская подпись", () => {
    // Значения ограничения lead_source_check на сегодня (V5 + V30).
    const вСхеме = ["site", "yandex_form", "email", "chat"];

    expect(Object.keys(LEAD_SOURCE).sort()).toEqual([...вСхеме].sort());
    for (const значение of вСхеме) {
      expect(LEAD_SOURCE[значение], значение).toBeTruthy();
      // Подпись, совпавшая с идентификатором, — это отсутствие подписи.
      expect(LEAD_SOURCE[значение]).not.toBe(значение);
    }
  });
});
