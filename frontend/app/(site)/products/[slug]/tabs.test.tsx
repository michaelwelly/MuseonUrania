import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Doc, Product } from "@/lib/api";
import ProductTabs from "./tabs";

// Вкладка «Документы» карточки изделия. Issue #73.
//
// До правки список был набран руками: три одинаковые строки на каждой
// карточке, все со ссылкой на форму. Проверяется, что список пришёл
// из перечня портала и что ссылка ведёт на файл, когда файл есть.

const product: Product = {
  slug: "vedal-r1",
  name: "VEDAL R1",
  kind: "Система реанимационная",
  categories: ["Неонатология"],
  status: "confirmed",
  summary: "Открытая реанимационная система",
};

const doc = (over: Partial<Doc> = {}): Doc => ({
  slug: "vedal-r1-product-sheet",
  title: "Система реанимационная VEDAL R1",
  group: "Техническая документация",
  product: "VEDAL R1",
  productSlug: "vedal-r1",
  access: "Файл",
  published: false,
  ...over,
});

const ФАЙЛ = "http://portal/api/public/v1/documents/vedal-r1-product-sheet/file";

/** Адрес ссылки разобранным: порядок параметров к делу не относится. */
const адрес = (a: HTMLElement) => new URL(a.getAttribute("href")!, "http://vedal.test");

async function открытьВкладку(documents: Doc[]) {
  render(<ProductTabs product={product} documents={documents} />);
  await userEvent.click(screen.getByRole("tab", { name: "Документы" }));
}

describe("документы к изделию", () => {
  it("выложенный файл скачивается ссылкой на портал, а не ведёт в форму", async () => {
    await открытьВкладку([doc({ published: true, file: ФАЙЛ })]);

    const ссылка = screen.getByRole("link", { name: /VEDAL R1/ });
    expect(ссылка).toHaveAttribute("href", ФАЙЛ);
    expect(ссылка).toHaveAttribute("download");
    expect(ссылка).not.toHaveAttribute("target");
    expect(ссылка).not.toHaveAttribute("rel");
  });

  it("документ без файла ведёт в форму с темой и изделием", async () => {
    await открытьВкладку([doc()]);

    const ссылка = screen.getByRole("link", { name: /VEDAL R1/ });
    // next/link в jsdom отдаёт адрес без хвостового слэша — его дописывает
    // сборка (trailingSlash). Проверяем маршрут, а не форму записи.
    expect(адрес(ссылка).pathname).toMatch(/^\/contacts\/?$/);
    // Человек стоит на карточке изделия: спрашивать у него и тему,
    // и изделие заново — это два выбора, которые можно сделать неверно.
    expect(адрес(ссылка).searchParams.get("topic")).toBe("catalog");
    expect(адрес(ссылка).searchParams.get("product")).toBe("vedal-r1");
    expect(ссылка).not.toHaveAttribute("target");
    expect(ссылка).toHaveTextContent("выдаётся по запросу");
  });

  // Подвал вкладки: «не найденное в перечне — запрашивается у специалиста».
  // Изделие карточке известно и здесь.
  it("запрос ненайденного документа тоже уносит изделие", async () => {
    await открытьВкладку([doc()]);

    const ссылка = screen.getByRole("link", { name: "запрашивается у специалиста" });
    expect(адрес(ссылка).searchParams.get("topic")).toBe("catalog");
    expect(адрес(ссылка).searchParams.get("product")).toBe("vedal-r1");
  });

  // Главное свойство: карточка больше ничего не придумывает. Раньше здесь
  // всегда стояли «Регистрационное удостоверение» и «Каталог продукции 2026»
  // — независимо от того, есть ли они у изделия в перечне.
  it("без строк в перечне кнопок нет вовсе", async () => {
    await открытьВкладку([]);

    expect(screen.queryByRole("link", { name: /Регистрационное удостоверение/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Каталог продукции/ })).toBeNull();
    expect(screen.getByText(/пока нет ни одной строки об этом изделии/)).toBeInTheDocument();
  });

  it("показывается ровно то, что передали, и в том же порядке", async () => {
    await открытьВкладку([
      doc({ slug: "ru", title: "Регистрационное удостоверение", access: "Уточняется" }),
      doc(),
    ]);

    const названия = screen
      .getAllByRole("link")
      .map((a) => a.textContent ?? "")
      .filter((t) => t.includes("удостоверение") || t.includes("VEDAL R1"));
    expect(названия).toHaveLength(2);
    expect(названия[0]).toContain("Регистрационное удостоверение");
    expect(названия[0]).toContain("согласуется");
  });
});

// Клавиатура. Issue #105.
//
// Роли `tablist` и `tab` стояли и раньше — то есть скринридер объявлял
// «вкладка, 1 из 3» и обещал стрелки, которых не существовало. Роль без
// клавиатуры хуже отсутствия роли: она даёт обещание.

describe("вкладки с клавиатуры", () => {
  const вкладки = () => screen.getAllByRole("tab");

  function отрисовать() {
    render(<ProductTabs product={product} documents={[]} />);
  }

  it("в порядок обхода Tab попадает одна вкладка — выбранная", () => {
    отрисовать();

    // Иначе человек с клавиатуры трижды нажимает Tab, чтобы миновать
    // переключатель из трёх кнопок.
    const [первая, ...остальные] = вкладки();
    expect(первая).toHaveAttribute("tabindex", "0");
    for (const t of остальные) expect(t).toHaveAttribute("tabindex", "-1");
  });

  it("стрелка вправо переключает вкладку и уводит на неё фокус", async () => {
    отрисовать();
    вкладки()[0].focus();

    await userEvent.keyboard("{ArrowRight}");

    const [первая, вторая] = вкладки();
    expect(вторая).toHaveAttribute("aria-selected", "true");
    expect(первая).toHaveAttribute("aria-selected", "false");
    // Фокус обязан ехать за выбором: у невыбранных вкладок tabindex −1,
    // и оставшись на прежней кнопке он оказался бы вне порядка обхода.
    expect(вторая).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Документы");
  });

  it("стрелка влево с первой вкладки уходит на последнюю", async () => {
    отрисовать();
    вкладки()[0].focus();

    await userEvent.keyboard("{ArrowLeft}");

    // По кругу — так написано в шаблоне WAI-ARIA, и так три вкладки
    // обходятся одной клавишей в любую сторону.
    const последняя = вкладки()[вкладки().length - 1];
    expect(последняя).toHaveAttribute("aria-selected", "true");
    expect(последняя).toHaveFocus();
  });

  it("Home и End прыгают на края", async () => {
    отрисовать();
    вкладки()[0].focus();

    await userEvent.keyboard("{End}");
    expect(вкладки()[вкладки().length - 1]).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{Home}");
    expect(вкладки()[0]).toHaveAttribute("aria-selected", "true");
    expect(вкладки()[0]).toHaveFocus();
  });

  it("Enter на вкладке по-прежнему её открывает", async () => {
    отрисовать();
    вкладки()[0].focus();

    // Обычное поведение кнопки. Проверяется потому, что перемещающийся
    // tabindex ломает именно его, если фокус не переносить вслед за выбором.
    await userEvent.keyboard("{ArrowRight}{Enter}");

    expect(вкладки()[1]).toHaveAttribute("aria-selected", "true");
  });
});
