import { describe, expect, it } from "vitest";

import { decideLang } from "./lang-preference";

// Старшинство: выбор человека > адрес с префиксом > язык браузера > русский.
//
// Проверяется здесь, а не глазами на живом сайте, потому что ошибка в этом
// правиле выглядит как бесконечный редирект или как язык, который
// «сам переключается обратно».

const EN_BROWSER = ["en-US", "en"];
const RU_BROWSER = ["ru-RU", "ru"];
const FR_BROWSER = ["fr-FR"];

describe("русский адрес, выбора ещё не было", () => {
  it("браузер на английском — уводим на английскую версию", () => {
    expect(decideLang("ru", "/products/", null, EN_BROWSER)).toEqual({
      kind: "go",
      lang: "en",
      href: "/en/products/",
    });
  });

  it("браузер на русском — остаёмся", () => {
    expect(decideLang("ru", "/products/", null, RU_BROWSER)).toEqual({ kind: "stay" });
  });

  // Языка сайта в предпочтениях нет вовсе. Уводить некуда: английская
  // версия для француза не лучше русской, а адрес меняется.
  it("незнакомый язык — остаёмся на русском", () => {
    expect(decideLang("ru", "/", null, FR_BROWSER)).toEqual({ kind: "stay" });
  });
});

describe("выбор человека сильнее автоопределения", () => {
  // Ради этого случая правило и написано: посетитель нажал «Русский»,
  // и на каждой следующей странице ему не должен возвращаться английский.
  it("выбран русский — автоопределение выключено", () => {
    expect(decideLang("ru", "/products/", "ru", EN_BROWSER)).toEqual({ kind: "stay" });
  });

  it("выбран китайский — уводим на него даже при английском браузере", () => {
    expect(decideLang("ru", "/about/", "zh", EN_BROWSER)).toEqual({
      kind: "go",
      lang: "zh",
      href: "/zh/about/",
    });
  });

  // В хранилище может лежать что угодно: старое значение, чужой ключ,
  // мусор от расширения. Это не повод никуда уводить.
  it("мусор в хранилище приравнивается к «остаться»", () => {
    expect(decideLang("ru", "/", "de", EN_BROWSER)).toEqual({ kind: "stay" });
  });
});

describe("адрес с префиксом", () => {
  // Уводить отсюда значило бы спорить с тем, что человек набрал сам
  // или получил ссылкой. Заодно это первый случай, когда выбор
  // запоминается без нажатия на переключатель.
  it("запоминает язык и никуда не уводит", () => {
    expect(decideLang("en", "/products/", null, RU_BROWSER)).toEqual({
      kind: "remember",
      lang: "en",
    });
  });

  it("повторный заход на тот же язык ничего не переписывает", () => {
    expect(decideLang("en", "/products/", "en", RU_BROWSER)).toEqual({ kind: "stay" });
  });

  // Открыл английскую версию, будучи «записанным» на китайский, — верным
  // остаётся адрес: он свежее.
  it("адрес перебивает старый выбор", () => {
    expect(decideLang("en", "/", "zh", RU_BROWSER)).toEqual({ kind: "remember", lang: "en" });
  });
});

describe("зацикливания не бывает", () => {
  // Увести можно только с русского адреса и только на другой язык.
  // Любой другой исход — «остаться» или «запомнить», то есть без перехода.
  it("переход возможен только с русского адреса", () => {
    const cases = [
      decideLang("en", "/", null, EN_BROWSER),
      decideLang("en", "/", "zh", ["zh"]),
      decideLang("zh", "/", null, RU_BROWSER),
    ];
    for (const decision of cases) expect(decision.kind).not.toBe("go");
  });

  it("переход никогда не ведёт на тот же язык", () => {
    const decision = decideLang("ru", "/", "ru", RU_BROWSER);
    expect(decision.kind).toBe("stay");
  });
});
