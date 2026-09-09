import { describe, expect, it } from "vitest";

import { ui } from "./ui";

// Словарь интерфейса.
//
// Тип `UiStrings` уже требует все ключи целиком — забытый не компилируется.
// Здесь проверяется то, чего тип не ловит: пустая строка вместо подписи
// и функции, которые собирают строку из числа и почты.
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

const flat = flatten(ui);

describe("полнота словаря", () => {
  it("пустых строк нет", () => {
    for (const [key, value] of Object.entries(flat)) {
      if (typeof value !== "string") continue;
      expect(value.trim(), key).not.toBe("");
    }
  });
});

describe("склонение и подстановка", () => {
  // Число документов над перечнем. Формы три, и правило второго десятка
  // («11 документов», не «11 документ») выражением по месту не пишется —
  // оно вынесено в lib/plural и вызывается отсюда.
  it("счётчик документов склоняется", () => {
    expect(ui.documents.count(1)).toBe("1 документ");
    expect(ui.documents.count(2)).toBe("2 документа");
    expect(ui.documents.count(5)).toBe("5 документов");
    expect(ui.documents.count(11)).toBe("11 документов");
    expect(ui.documents.count(21)).toBe("21 документ");
  });

  it("почта подставляется в сообщение о неподключённой рассылке", () => {
    expect(ui.news.subscribePending("sales@vedal-med.ru")).toContain("sales@vedal-med.ru");
  });
});
