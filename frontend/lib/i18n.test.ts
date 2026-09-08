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
    expect(localePath("zh", "/legal/privacy/")).toBe("/zh/legal/privacy/");
  });

  // trailingSlash в next.config: адрес без слеша отвечает 308, и ссылка
  // из шапки заставляла бы браузер ходить дважды за каждой страницей.
  it("корень переведённой версии — со слэшем на конце", () => {
    expect(localePath("en", "/")).toBe("/en/");
    expect(localePath("zh", "/")).toBe("/zh/");
  });

  it("путь без ведущего слэша всё равно даёт абсолютный адрес", () => {
    expect(localePath("en", "products/")).toBe("/en/products/");
  });
});

describe("разбор адреса", () => {
  it("узнаёт язык и путь внутри него", () => {
    expect(stripLocale("/en/products/")).toEqual({ lang: "en", path: "/products/" });
    expect(stripLocale("/zh/news/innoprom-2026/")).toEqual({
      lang: "zh",
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
  it("называет все три версии и запасную", () => {
    expect(alternateLanguages("/products/")).toEqual({
      ru: "/products/",
      en: "/en/products/",
      "zh-Hans": "/zh/products/",
      "x-default": "/products/",
    });
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
    expect(preferredLang(["fr-FR", "zh-Hans-CN", "en"])).toBe("zh");
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
  it("под префиксом живут все языки, кроме русского", () => {
    expect(PREFIXED_LANGS).toEqual(["en", "zh"]);
  });

  // zh, а не zh-Hans, оставило бы браузеру выбор между упрощённым
  // и традиционным начертанием, а от него зависит подбор шрифта.
  it("китайский помечается упрощённым начертанием", () => {
    expect(htmlLang.zh).toBe("zh-Hans");
  });

  it("узнаёт свои коды и не узнаёт чужие", () => {
    for (const lang of LANGS) expect(isLang(lang)).toBe(true);
    expect(isLang("de")).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
});
