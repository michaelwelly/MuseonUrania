import { describe, expect, it } from "vitest";

import { UI } from "./ui";
import { LANGS, type Lang } from "@/lib/i18n";
import { contentText } from "@/lib/content-i18n";

// Словарь интерфейса.
//
// Тип `UiStrings` уже требует все три языка целиком — забытая ветка
// не компилируется. Здесь проверяется то, чего тип не ловит: пустая строка,
// строка, оставшаяся русской в английском словаре, и функция-склонение.
//
// Пустая строка страшнее отсутствующей: отсутствующую видит компилятор,
// пустую — только посетитель, у которого кнопка без подписи.

type Leaf = string | ((n: number) => string) | Record<string, string>;

/** Плоский обход словаря: «form.errors.name» → значение. */
function flatten(value: unknown, prefix = ""): Record<string, Leaf> {
  if (typeof value === "string" || typeof value === "function") {
    return { [prefix]: value as Leaf };
  }
  const out: Record<string, Leaf> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    Object.assign(out, flatten(nested, prefix ? `${prefix}.${key}` : key));
  }
  return out;
}

const flat = Object.fromEntries(LANGS.map((lang) => [lang, flatten(UI[lang])])) as Record<
  Lang,
  Record<string, Leaf>
>;

/**
 * Карта подписей карточек контактов — исключение из правила «одни и те же
 * ключи». Её ключи это русские оригиналы из content/contacts.ts, и в русском
 * словаре она пуста намеренно: переводить «Телефон» на русский незачем,
 * а страница берёт подпись как `blockTitles[title] ?? title`.
 */
const BY_ORIGINAL = "contacts.blockTitles";

const keysOf = (lang: Lang) =>
  Object.keys(flat[lang])
    .filter((key) => !key.startsWith(BY_ORIGINAL))
    .sort();

describe("полнота словаря", () => {
  it("во всех языках одни и те же ключи", () => {
    const ru = keysOf("ru");
    for (const lang of LANGS) {
      expect(keysOf(lang), `язык ${lang}`).toEqual(ru);
    }
  });

  it("пустых строк нет — кроме примечания о переводе на русском", () => {
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(flat[lang])) {
        if (typeof value !== "string") continue;
        // На русской версии переводить нечего, и примечание не рисуется:
        // пустая строка здесь — сигнал «не показывать», а не забытый текст.
        if (lang === "ru" && key.startsWith("fallback.")) continue;
        expect(value.trim(), `${lang}.${key}`).not.toBe("");
      }
    }
  });
});

describe("переводы не остались русскими", () => {
  // Самый частый способ сломать словарь — скопировать русскую ветку целиком
  // и перевести половину. Компилятор такое пропускает: строка на месте.
  //
  // Проверяются разделы, где совпадение с русским невозможно по смыслу.
  // Например `form.fallbackEnd` сюда не входит: точка в конце фразы
  // у русского и английского одна и та же.
  const CHECKED = ["nav.", "crumbs.", "actions.", "header.cta", "products.", "product.", "documents.", "news."];

  for (const lang of LANGS.filter((l) => l !== "ru")) {
    it(`${lang}: подписи разделов, кнопок и вкладок отличаются от русских`, () => {
      for (const [key, value] of Object.entries(flat[lang])) {
        if (typeof value !== "string") continue;
        if (!CHECKED.some((prefix) => key.startsWith(prefix))) continue;
        expect(value, `${lang}.${key}`).not.toBe(flat.ru[key]);
      }
    });
  }
});

describe("склонение и подстановка", () => {
  // Число документов над перечнем. Русские формы — три, английские — две,
  // китайская одна; вынесены в словарь именно поэтому.
  it("русский счётчик склоняется", () => {
    expect(UI.ru.documents.count(1)).toBe("1 документ");
    expect(UI.ru.documents.count(2)).toBe("2 документа");
    expect(UI.ru.documents.count(5)).toBe("5 документов");
    expect(UI.ru.documents.count(11)).toBe("11 документов");
    expect(UI.ru.documents.count(21)).toBe("21 документ");
  });

  it("английский счётчик берёт множественное число со второго", () => {
    expect(UI.en.documents.count(1)).toBe("1 document");
    expect(UI.en.documents.count(2)).toBe("2 documents");
  });

  it("почта подставляется в сообщение о неподключённой рассылке", () => {
    for (const lang of LANGS) {
      expect(UI[lang].news.subscribePending("sales@vedal-med.ru")).toContain("sales@vedal-med.ru");
    }
  });
});

describe("откат содержательного текста на русский", () => {
  const RU_ORIGINAL = "Регистрационное удостоверение";

  it("на русской версии ничего не помечается", () => {
    const c = contentText("ru");
    expect(c.t(RU_ORIGINAL)).toBe(RU_ORIGINAL);
    expect(c.mark(RU_ORIGINAL)).toBeUndefined();
  });

  // Переводов ещё нет — их согласовывает заказчик. Значит английская
  // страница показывает русский оригинал, и он обязан быть помечен `lang`:
  // иначе браузер, скринридер и встроенный переводчик считают его английским.
  it("перевода нет — показываем оригинал и помечаем его языком", () => {
    const c = contentText("en");
    expect(c.t(RU_ORIGINAL)).toBe(RU_ORIGINAL);
    expect(c.mark(RU_ORIGINAL)).toBe("ru");
  });

  it("блок помечается русским, если хоть одна его строка осталась оригиналом", () => {
    const c = contentText("en");
    expect(c.mark("первая", "вторая")).toBe("ru");
  });
});
