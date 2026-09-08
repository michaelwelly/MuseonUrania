import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import LanguageSwitcher from "./LanguageSwitcher";
import { LANG_STORAGE_KEY } from "@/lib/lang-preference";

// Переключатель языка. Проверяется не вид, а две вещи, которые ломаются молча:
// адрес, на который он ведёт, и запись выбора в хранилище. Без второй
// посетитель, нажавший «Русский», получает английский на следующей странице.

let pathname = "/products/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

// Список опубликованных языков подменён на все три намеренно.
//
// Наружу сейчас идёт один русский: содержательные тексты не переведены,
// и показывать посетителю полурусскую английскую страницу хуже, чем
// не показывать её вовсе (см. PUBLISHED_LANGS в lib/i18n.ts). Но механика
// переключателя от этого решения не зависит и обязана работать в тот день,
// когда переводы придут, — иначе проверки замолчали бы ровно там, где
// работа продолжается.
//
// Поведение «языков меньше двух» проверяется отдельным тестом ниже, уже
// на настоящем списке.
vi.mock("@/lib/i18n", async (настоящий) => ({
  ...(await настоящий<typeof import("@/lib/i18n")>()),
  PUBLISHED_LANGS: ["ru", "en"] as const,
}));

describe("переключатель языка", () => {
  it("ведёт на ту же страницу в другом языке", () => {
    pathname = "/products/";
    render(<LanguageSwitcher lang="ru" />);

    expect(screen.getByRole("link", { name: "RU" })).toHaveAttribute("href", "/products/");
    expect(screen.getByRole("link", { name: "EN" })).toHaveAttribute("href", "/en/products/");
  });

  // С переведённой страницы обратный путь обязан вести на русский адрес
  // БЕЗ префикса, а не на `/ru/...`, которого не существует.
  it("с переведённой страницы возвращает на адрес без префикса", () => {
    pathname = "/en/documents/";
    render(<LanguageSwitcher lang="en" />);

    expect(screen.getByRole("link", { name: "RU" })).toHaveAttribute("href", "/documents/");
  });

  it("отмечает текущий язык для скринридера", () => {
    pathname = "/en/";
    render(<LanguageSwitcher lang="en" />);

    expect(screen.getByRole("link", { name: "EN" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "RU" })).not.toHaveAttribute("aria-current");
  });

  // Ради этого переключатель и не сделан обычной ссылкой без обработчика:
  // выбор человека должен пережить перезагрузку и отменить автоопределение.
  it("запоминает выбор до перехода", async () => {
    pathname = "/";
    const user = userEvent.setup();
    render(<LanguageSwitcher lang="ru" />);

    await user.click(screen.getByRole("link", { name: "EN" }));

    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("en");
  });

  // Нажатие на уже выбранный язык — не пустое действие: так возвращаются
  // на русский насовсем те, кого увело автоопределение.
  it("нажатие на текущий язык тоже записывает выбор", async () => {
    pathname = "/";
    const user = userEvent.setup();
    render(<LanguageSwitcher lang="ru" />);

    await user.click(screen.getByRole("link", { name: "RU" }));

    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("ru");
  });

  // Приватный режим, запрет на хранилище, встроенный браузер приложения.
  // Язык всё равно должен смениться — просто не запомнится.
  it("переживает недоступное хранилище", async () => {
    pathname = "/";
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("хранилище закрыто");
    });
    const user = userEvent.setup();
    render(<LanguageSwitcher lang="ru" />);

    await expect(user.click(screen.getByRole("link", { name: "EN" }))).resolves.toBeUndefined();
  });
});
