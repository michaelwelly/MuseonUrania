import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Кнопки-якоря. Issue #101 и #103.
//
// Виджет Ведалины открывается по событию `hashchange`
// (`components/VedalinaWidget.tsx`). Браузер шлёт его только на настоящей
// навигации по хешу, а `next/link` перехватывает клик и меняет адрес своим
// `history.pushState` — события не наступает вовсе. Кнопки «Спросить
// Ведалину» и «Открыть чат», нарисованные через `Link`, дописывали
// `#vedalina` в адрес и не открывали ничего.
//
// Отличить `Link` от обычного `<a>` в разметке нельзя — оба рисуют `<a>`
// с тем же href. Поэтому `next/link` здесь подменяется меткой: тест
// проверяет не вид ссылки, а то, каким компонентом она нарисована,
// потому что ломается именно это.

vi.mock("next/link", () => ({
  default: ({
    children,
    ...rest
  }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a data-next-link="1" {...rest}>
      {children}
    </a>
  ),
}));

import { homeHero } from "@/content/home";
import { DarkCta } from "./Blocks";

describe("кнопки тёмной полосы призыва", () => {
  it("якорь внутри страницы рисуется обычной ссылкой, а не next/link", () => {
    render(
      <DarkCta
        title="Не нашли нужную конфигурацию?"
        text="Опишите задачу отделения."
        pattern={7}
        primary={{ label: "Запросить подбор", href: "/contacts/" }}
        secondary={{ label: "Спросить Ведалину", href: "#vedalina" }}
      />,
    );

    const якорь = screen.getByRole("link", { name: "Спросить Ведалину" });
    expect(якорь).toHaveAttribute("href", "#vedalina");
    expect(якорь).not.toHaveAttribute("data-next-link");
  });

  it("переход на другой адрес остаётся клиентским", () => {
    render(
      <DarkCta
        title="Не нашли нужную конфигурацию?"
        text="Опишите задачу отделения."
        pattern={7}
        primary={{ label: "Запросить подбор", href: "/contacts/" }}
      />,
    );

    // Обратная сторона правила: обычными `<a>` становятся только якоря.
    // Сделать такими все ссылки значило бы отменить клиентские переходы
    // по всему сайту.
    expect(screen.getByRole("link", { name: "Запросить подбор" })).toHaveAttribute(
      "data-next-link",
      "1",
    );
  });
});

describe("первый экран главной", () => {
  it("«Запросить КП» ведёт на форму этой же страницы, а не на контакты", () => {
    // Issue #103: кнопка уводила на /contacts/, где человек заново выбирал
    // тему обращения, — хотя форма запроса КП стоит внизу главной. То же
    // решение уже принято для карточки изделия в issue #92.
    //
    // Цель якоря — id секции с формой в `app/(site)/screen.tsx`.
    expect(homeHero.primary.href).toBe("#quote");
  });
});
