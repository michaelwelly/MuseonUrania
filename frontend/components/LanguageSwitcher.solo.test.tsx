import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import LanguageSwitcher from "./LanguageSwitcher";
import { PUBLISHED_LANGS } from "@/lib/i18n";

// Отдельный файл, а не ещё один случай в LanguageSwitcher.test.tsx: там
// список опубликованных языков подменён на все три, чтобы проверять
// механику перехода. Здесь список настоящий — проверяется ровно то, что
// видит сегодняшний посетитель.

vi.mock("next/navigation", () => ({ usePathname: () => "/products/" }));

describe("переключатель языка при одном опубликованном языке", () => {
  // Пустая навигация с меткой «Язык» — не безобидная мелочь. Скринридер
  // объявляет область, в которой нечего выбирать, а зрячий видит одинокую
  // надпись «RU» и читает её как сломанный список.
  it("не рисуется вовсе", () => {
    render(<LanguageSwitcher lang="ru" />);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  // Проверка держит не число, а связь: переключатель появляется тогда же,
  // когда появляется второй язык, и не раньше. Сломать это можно, добавив
  // язык в список и забыв про содержание, — тогда упадёт этот тест, а не
  // заказчик на боевом сайте.
  it("список опубликованных языков и есть причина", () => {
    expect(PUBLISHED_LANGS.length).toBe(1);
    expect(PUBLISHED_LANGS[0]).toBe("ru");
  });
});
