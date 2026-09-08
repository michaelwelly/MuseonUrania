// Языки сайта: русский, английский, китайский.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему письменность, а не страна
//
// Ассистент уже разведён по трём языкам — `backend/assistant/Guardrails`,
// enum `Speech` c значениями RU / EN / ZH. Там язык определяется по
// письменности вопроса: кириллица → русский, иероглифы → китайский, всё
// остальное → английский. Интерфейс ложится на ту же модель намеренно:
// три языка, те же три кода, тот же порядок приоритета. Заведя здесь
// `en-US` и `zh-CN`, мы получили бы два несовпадающих справочника языков
// в одном продукте — и вопрос «почему ассистент отвечает по-английски,
// а страница по-русски» стал бы вопросом про склейку кодов.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему префикс в пути, а не поддомен
//
// Поддомен (`en.vedal-med.ru`) требует своего сертификата, своей записи DNS
// и своей сборки; префикс не требует ничего — сайт остаётся одним
// приложением и одной сборкой. Домен у проекта пока один и тот ещё
// не подключён (`docs/operations/`), заводить под перевод три — значит
// оплачивать разделение до того, как появился хоть один переведённый абзац.
//
// Русский живёт без префикса. Адреса `/products/`, `/about/` полтора месяца
// лежат в каталоге, в презентации и в письмах заказчику; переезд на `/ru/`
// сделал бы редирект из каждой такой ссылки. Русская версия ведущая
// (правило 3 в CLAUDE.md) — значит она и стоит в корне.

export const LANGS = ["ru", "en", "zh"] as const;

export type Lang = (typeof LANGS)[number];

/**
 * Русский — язык по умолчанию и единственный без префикса в адресе.
 *
 * Тип литеральный (`"ru"`, а не `Lang`) намеренно: тогда сравнение
 * `lang === DEFAULT_LANG` сужает тип до остальных языков, и словарь
 * переводов, у которого русского ключа нет и быть не может, индексируется
 * без приведений.
 */
export const DEFAULT_LANG = "ru" satisfies Lang;

/** Языки, живущие под префиксом. Именно их перечисляет `generateStaticParams`. */
export const PREFIXED_LANGS = LANGS.filter((lang) => lang !== DEFAULT_LANG);

/**
 * Значение атрибута `lang` у `<html>`.
 *
 * Китайский — `zh-Hans`, а не `zh`: тег без указания письменности оставляет
 * браузеру догадываться между упрощённым и традиционным начертанием, а от
 * этого зависит подбор шрифта. Материалы заказчика ориентированы на КНР,
 * то есть на упрощённое.
 */
export const htmlLang: Record<Lang, string> = {
  ru: "ru",
  en: "en",
  zh: "zh-Hans",
};

/** Название языка на нём самом — так его узнаёт тот, кто ищет свой. */
export const langName: Record<Lang, string> = {
  ru: "Русский",
  en: "English",
  zh: "中文",
};

/** Короткая подпись для переключателя. */
export const langShort: Record<Lang, string> = {
  ru: "RU",
  en: "EN",
  zh: "中文",
};

/** Локаль Open Graph: у неё свой формат, `ru_RU`, а не `ru`. */
export const ogLocale: Record<Lang, string> = {
  ru: "ru_RU",
  en: "en_US",
  zh: "zh_CN",
};

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

/**
 * Адрес страницы на заданном языке.
 *
 * Путь передаётся языконезависимым — `/products/`, — а префикс дописывается
 * здесь. Так ни одна ссылка в разметке не знает про языки: она знает свой
 * раздел, а язык приходит сверху, из маршрута.
 */
export function localePath(lang: Lang, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (lang === DEFAULT_LANG) return clean;
  // Корень — `/en/`, а не `/en`: в next.config включён trailingSlash,
  // и адрес без слеша отвечает редиректом 308.
  return clean === "/" ? `/${lang}/` : `/${lang}${clean}`;
}

/**
 * Разбор адреса обратно: какой язык и какой путь внутри него.
 *
 * Нужен переключателю языка и автоопределению — они работают в браузере
 * и видят только `location.pathname`.
 */
export function stripLocale(pathname: string): { lang: Lang; path: string } {
  const match = /^\/([^/]+)(\/.*)?$/.exec(pathname);
  const head = match?.[1];
  if (!head || !isLang(head) || head === DEFAULT_LANG) {
    return { lang: DEFAULT_LANG, path: pathname || "/" };
  }
  const rest = match[2] ?? "/";
  return { lang: head, path: rest === "" ? "/" : rest };
}

/**
 * Ссылки `hreflang` для одной страницы.
 *
 * `x-default` указывает на русскую версию: это язык, на котором сайт полон.
 * Поисковик отдаёт её тому, чей язык не назван ни одной из трёх строк —
 * а не первую попавшуюся.
 */
export function alternateLanguages(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const lang of LANGS) languages[htmlLang[lang]] = localePath(lang, path);
  languages["x-default"] = localePath(DEFAULT_LANG, path);
  return languages;
}

/**
 * Язык из списка предпочтений браузера.
 *
 * `navigator.languages` приходит в порядке убывания предпочтения и в виде
 * тегов BCP 47: `en-GB`, `zh-Hans-CN`, `ru`. Сравнивается только первая
 * часть — регион нам не важен, вариантов сайта по регионам нет.
 *
 * Ничего не подошло — возвращается `null`, а не русский: «не знаем» и
 * «русский» это разные ответы, и вызывающий код по-разному на них реагирует.
 */
export function preferredLang(accepted: readonly string[]): Lang | null {
  for (const tag of accepted) {
    const primary = tag.trim().toLowerCase().split("-")[0];
    if (isLang(primary)) return primary;
  }
  return null;
}
