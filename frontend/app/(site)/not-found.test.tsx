import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { site } from "@/content/site";
import NotFound from "./not-found";

// Страница «не найдено». Issue #104.
//
// До неё неизвестный слаг изделия отдавал разметку с пустым body — белый
// экран без единой ссылки, — а несуществующий адрес отдавал встроенную
// заглушку Next по-английски. Проверяется то, ради чего страница заведена:
// человек понимает, что случилось, и ему есть куда уйти.

describe("страница «не найдено»", () => {
  it("объясняет по-русски, что адреса нет", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: "Страница не найдена" })).toBeInTheDocument();
    expect(screen.getByText(/По этому адресу на сайте ничего нет/)).toBeInTheDocument();
  });

  it("не выдумывает причину", () => {
    render(<NotFound />);

    // Сайт не знает, почему адреса нет. «Изделие снято с производства»
    // или «документ отозван» здесь были бы правдоподобной выдумкой,
    // а правила контента её запрещают.
    const текст = document.body.textContent ?? "";
    expect(текст).not.toMatch(/снят|отозв|удал[ёе]н/i);
  });

  it("уводит в разделы, а не оставляет в тупике", () => {
    render(<NotFound />);

    // Слеш на конце снимается: в сборке он есть (trailingSlash в next.config),
    // а `next/link` вне сборки его срезает — здесь проверяется не форма
    // адреса, а то, что тупика нет.
    const адреса = screen
      .getAllByRole("link")
      .map((a) => (a.getAttribute("href") ?? "").replace(/(.)\/$/, "$1"));
    // Главная плюс четыре входа, за которыми люди приходят на сайт.
    expect(адреса).toEqual(
      expect.arrayContaining(["/", "/products", "/documents", "/service", "/contacts"]),
    );
  });

  it("даёт телефон и почту из общего места, а не набранные здесь", () => {
    render(<NotFound />);

    expect(screen.getByRole("link", { name: site.phone })).toHaveAttribute(
      "href",
      `tel:${site.phone.replace(/\s/g, "")}`,
    );
    expect(screen.getByRole("link", { name: site.email })).toHaveAttribute(
      "href",
      `mailto:${site.email}`,
    );
  });
});
