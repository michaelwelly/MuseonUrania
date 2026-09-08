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

describe("переключатель языка", () => {
  it("ведёт на ту же страницу в другом языке", () => {
    pathname = "/products/";
    render(<LanguageSwitcher lang="ru" />);

    expect(screen.getByRole("link", { name: "RU" })).toHaveAttribute("href", "/products/");
    expect(screen.getByRole("link", { name: "EN" })).toHaveAttribute("href", "/en/products/");
    expect(screen.getByRole("link", { name: "中文" })).toHaveAttribute("href", "/zh/products/");
  });

  // С переведённой страницы обратный путь обязан вести на русский адрес
  // БЕЗ префикса, а не на `/ru/...`, которого не существует.
  it("с переведённой страницы возвращает на адрес без префикса", () => {
    pathname = "/en/documents/";
    render(<LanguageSwitcher lang="en" />);

    expect(screen.getByRole("link", { name: "RU" })).toHaveAttribute("href", "/documents/");
    expect(screen.getByRole("link", { name: "中文" })).toHaveAttribute("href", "/zh/documents/");
  });

  it("отмечает текущий язык для скринридера", () => {
    pathname = "/zh/";
    render(<LanguageSwitcher lang="zh" />);

    expect(screen.getByRole("link", { name: "中文" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "EN" })).not.toHaveAttribute("aria-current");
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
