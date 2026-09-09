import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Опора коробки узора.
//
// ————— почему тест читает исходники, а не рисует экран —————
//
// Ломается тут не разметка, а стили, и ломается тихо. Коробка узора лежит
// `position: absolute`, и если у секции нет своей системы координат, коробка
// цепляется за первого позиционированного предка — за всю страницу. Разметка
// при этом правильная, компонент отрисован, фигур ровно семнадцать; неверно
// только то, откуда они отсчитаны.
//
// Это уже случилось. Узор тёмной полосы главной без `position` у секции
// вылез поверх первого экрана тремя яркими квадратами по двести пикселей —
// на экране, который к тому времени был согласован с владельцем портала.
//
// Нарисовать этот случай в jsdom нельзя: там нет ни раскладки, ни каскада,
// `getComputedStyle` вернёт пустое `position`, и тест был бы зелёным при
// любом дефекте. Поэтому проверяются те самые файлы, в которых ошибка
// и живёт, — разметка и стили рядом с ней.

const КОРЕНЬ = resolve(import.meta.dirname, "..");

/** Файлы, где стоит узор. Список собирается из самих исходников. */
const МЕСТА = [
  "app/(site)/screen.tsx",
  "app/(site)/not-found.tsx",
  "app/(site)/news/screen.tsx",
  "app/(site)/production/screen.tsx",
  "app/(site)/service/screen.tsx",
  "components/PageHero.tsx",
  "components/Blocks.tsx",
];

const читать = (путь: string) => readFileSync(join(КОРЕНЬ, путь), "utf8");

/** Тела всех правил для класса: `.foo { … }` из файла стилей. */
function правила(css: string, класс: string): string[] {
  const тела: string[] = [];
  const шаблон = new RegExp(`(^|[\\s,}])\\.${класс}\\s*\\{([^}]*)\\}`, "g");
  for (const m of css.matchAll(шаблон)) тела.push(m[2]);
  return тела;
}

const объявляет = (тела: string[], свойство: string, значение: string) =>
  тела.some((т) => new RegExp(`${свойство}\\s*:\\s*${значение}\\s*;`).test(т));

/** Модуль стилей, который импортирует файл разметки. */
function стилиРядом(файл: string): string {
  const src = читать(файл);
  const m = src.match(/import styles from "(\.[^"]+\.module\.css)"/);
  if (!m) throw new Error(`${файл}: не найден импорт модуля стилей`);
  return readFileSync(resolve(КОРЕНЬ, dirname(файл), m[1]), "utf8");
}

/**
 * Пары «коробка — её хозяин» для каждого узора в файле.
 *
 * Разбор нарочно наивный: ближайший `className` перед `<BrandPattern` —
 * коробка, предыдущий — секция, в которой она лежит. Так узор и ставится
 * во всех семи местах, и наивность здесь к месту: тест должен упасть,
 * если кто-то поставит узор иначе, а не молча пропустить новый случай.
 */
function пары(файл: string) {
  const src = читать(файл);
  // Скобки считаются, а не ищутся регулярным выражением: класс секции —
  // это шаблонная строка со вложенными `${…}`, и «до первой закрывающей»
  // обрезало бы её ровно на середине.
  const классы: { at: number; выражение: string }[] = [];
  for (const начало of src.matchAll(/className=\{/g)) {
    let глубина = 1;
    let i = начало.index! + начало[0].length;
    for (; i < src.length && глубина > 0; i++) {
      if (src[i] === "{") глубина++;
      else if (src[i] === "}") глубина--;
    }
    классы.push({ at: начало.index!, выражение: src.slice(начало.index! + начало[0].length, i - 1) });
  }

  const найденные: { коробка: string; хозяин: string }[] = [];
  for (const узор of src.matchAll(/<BrandPattern[\s/>]/g)) {
    const до = классы.filter((c) => c.at < узор.index!);
    expect(
      до.length,
      `${файл}: у узора нет ни коробки, ни секции — некуда отсчитывать`,
    ).toBeGreaterThanOrEqual(2);
    найденные.push({
      коробка: до[до.length - 1].выражение,
      хозяин: до[до.length - 2].выражение,
    });
  }
  return найденные;
}

/** Имена классов модуля из выражения вида `${styles.hero} patternHost`. */
const модульные = (выражение: string) =>
  [...выражение.matchAll(/styles\.([A-Za-z0-9_]+)/g)].map((m) => m[1]);

describe("узору нужна опора", () => {
  const globals = читать("app/globals.css");

  it("утилита .patternHost даёт систему координат и обрезку", () => {
    const тела = правила(globals, "patternHost");

    expect(тела).not.toHaveLength(0);
    expect(объявляет(тела, "position", "relative")).toBe(true);
    expect(объявляет(тела, "overflow", "hidden")).toBe(true);
  });

  it("узор стоит ровно в перечисленных местах — новое место надо вписать", () => {
    const найденные = МЕСТА.filter((f) => читать(f).includes("<BrandPattern"));

    expect(найденные).toEqual(МЕСТА);
  });

  it.each(МЕСТА)("%s: коробка узора лежит абсолютом и не ловит мышь", (файл) => {
    const css = стилиРядом(файл);

    for (const { коробка } of пары(файл)) {
      for (const класс of модульные(коробка)) {
        const тела = правила(css, класс);
        expect(тела, `${файл}: класс .${класс} не описан в стилях`).not.toHaveLength(0);
        expect(объявляет(тела, "position", "absolute"), `${файл}: .${класс}`).toBe(true);
        expect(объявляет(тела, "pointer-events", "none"), `${файл}: .${класс}`).toBe(true);
        expect(объявляет(тела, "overflow", "hidden"), `${файл}: .${класс}`).toBe(true);
      }
    }
  });

  it.each(МЕСТА)("%s: у секции с узором своя система координат", (файл) => {
    const css = стилиРядом(файл);

    for (const { хозяин } of пары(файл)) {
      // Либо общая утилита из globals.css, либо собственное правило секции —
      // важно не какое из двух, а что опора есть.
      if (хозяин.includes("patternHost")) continue;

      const классы = модульные(хозяин);
      expect(классы, `${файл}: у секции с узором нет класса`).not.toHaveLength(0);

      // Спрашивается только `position`. Обрезка — забота самой коробки,
      // она объявляет `overflow: hidden` у себя (проверено выше); секции
      // от неё нужна одна вещь — быть точкой отсчёта. Первый экран главной
      // как раз обходится без `overflow`, и это не дефект.
      const тела = классы.flatMap((класс) => правила(css, класс));
      expect(
        объявляет(тела, "position", "relative"),
        `${файл}: ${классы.join(", ")} — узор отсчитается от чужой коробки`,
      ).toBe(true);
    }
  });

  it("страница-документ остаётся без узора", () => {
    const privacy = читать("app/(site)/legal/privacy/screen.tsx");

    expect(privacy).not.toContain("BrandPattern");
    expect(privacy).toContain("pattern={null}");
  });
});
