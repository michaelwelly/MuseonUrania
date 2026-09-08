import { describe, expect, it } from "vitest";

import {
  alternateLanguages,
  DEFAULT_LANG,
  htmlLang,
  isLang,
  LANGS,
  localePath,
  PREFIXED_LANGS,
  preferredLang,
  PUBLISHED_LANGS,
  stripLocale,
} from "./i18n";

// Адреса языковых версий. Ломается тут молча: неверный префикс не роняет
// ни сборку, ни страницу — он даёт 404 по ссылке из меню и дубль в выдаче.

describe("адрес языковой версии", () => {
  it("русский остаётся без префикса", () => {
    expect(localePath("ru", "/products/")).toBe("/products/");
    expect(localePath("ru", "/")).toBe("/");
  });

  it("остальные языки получают префикс", () => {
    expect(localePath("en", "/products/")).toBe("/en/products/");
  });

  // trailingSlash в next.config: адрес без слеша отвечает 308, и ссылка
  // из шапки заставляла бы браузер ходить дважды за каждой страницей.
  it("корень переведённой версии — со слэшем на конце", () => {
    expect(localePath("en", "/")).toBe("/en/");
  });

  it("путь без ведущего слэша всё равно даёт абсолютный адрес", () => {
    expect(localePath("en", "products/")).toBe("/en/products/");
  });
});

describe("разбор адреса", () => {
  it("узнаёт язык и путь внутри него", () => {
    expect(stripLocale("/en/products/")).toEqual({ lang: "en", path: "/products/" });
    expect(stripLocale("/en/news/innoprom-2026/")).toEqual({
      lang: "en",
      path: "/news/innoprom-2026/",
    });
  });

  it("корень переведённой версии разбирается в путь «/»", () => {
    expect(stripLocale("/en/")).toEqual({ lang: "en", path: "/" });
    expect(stripLocale("/en")).toEqual({ lang: "en", path: "/" });
  });

  it("адрес без префикса — русский, и путь остаётся целым", () => {
    expect(stripLocale("/products/")).toEqual({ lang: "ru", path: "/products/" });
    expect(stripLocale("/")).toEqual({ lang: "ru", path: "/" });
  });

  // Главная ловушка: раздел, чьё имя похоже на код языка, не должен
  // съедаться как префикс. Сегодня таких разделов нет, но появление
  // раздела `/es/` не должно превращать его в испанскую версию сайта.
  it("не принимает за язык то, чего нет в списке", () => {
    expect(stripLocale("/es/products/")).toEqual({ lang: "ru", path: "/es/products/" });
  });

  // `/ru/` не заводится: русская версия живёт в корне, и второй её адрес
  // был бы дублем для поисковика.
  it("не принимает /ru/ за языковой префикс", () => {
    expect(stripLocale("/ru/products/")).toEqual({ lang: "ru", path: "/ru/products/" });
  });
});

describe("hreflang", () => {
  // Названы опубликованные версии, а не все заведённые. Разница не в
  // формальности: hreflang на страницу, которой нет, — обещание поисковику,
  // за которым ничего не стоит, и обходчик приносит человеку 404.
  it("называет каждую опубликованную версию и запасную", () => {
    const ожидаемое: Record<string, string> = { "x-default": "/products/" };
    for (const lang of PUBLISHED_LANGS) ожидаемое[htmlLang[lang]] = localePath(lang, "/products/");

    expect(alternateLanguages("/products/")).toEqual(ожидаемое);
  });

  // Отдельно и прямо: неопубликованного языка в hreflang быть не должно.
  // Проверка переживёт возврат языков — она смотрит на список, а не на код.
  it("не обещает языков, которых нет наружу", () => {
    const названные = Object.keys(alternateLanguages("/products/"));

    for (const lang of LANGS) {
      if (PUBLISHED_LANGS.includes(lang)) continue;
      expect(названные).not.toContain(htmlLang[lang]);
    }
  });

  // x-default — та версия, которую отдают человеку, чей язык не назван
  // ни одной строкой. Это русская: она полная, в остальных содержательные
  // тексты пока показываются оригиналом.
  it("запасная версия — русская", () => {
    expect(alternateLanguages("/")["x-default"]).toBe(localePath(DEFAULT_LANG, "/"));
  });
});

describe("язык браузера", () => {
  it("берёт первый подходящий из списка предпочтений", () => {
    expect(preferredLang(["en-GB", "ru"])).toBe("en");
    expect(preferredLang(["fr-FR", "en-GB", "ru"])).toBe("en");
  });

  it("не путается в регионе и регистре", () => {
    expect(preferredLang(["RU-ru"])).toBe("ru");
    expect(preferredLang([" en-US "])).toBe("en");
  });

  // Пустой ответ и «русский» — разные вещи: на первый мы ничего не делаем,
  // на второй выключаем автоопределение.
  it("ничего не нашлось — это null, а не русский", () => {
    expect(preferredLang(["fr", "de"])).toBeNull();
    expect(preferredLang([])).toBeNull();
  });
});

describe("справочник языков", () => {
  // Не «все, кроме русского», а «опубликованные, кроме русского»: пока
  // переводов нет, список пуст, и Next не собирает ни одной страницы под
  // префиксом — адрес честно отвечает «нет такой страницы».
  it("под префиксом живут опубликованные языки, кроме русского", () => {
    expect(PREFIXED_LANGS).toEqual(PUBLISHED_LANGS.filter((lang) => lang !== "ru"));
  });

  it("узнаёт свои коды и не узнаёт чужие", () => {
    for (const lang of LANGS) expect(isLang(lang)).toBe(true);
    expect(isLang("de")).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
});
