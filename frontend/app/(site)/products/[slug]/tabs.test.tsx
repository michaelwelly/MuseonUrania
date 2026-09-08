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
  slug: "opisanie-izdeliya-vedal-r1-r2",
  title: "Описание изделия",
  group: "Техническая документация",
  product: "VEDAL R1",
  productSlug: "vedal-r1",
  access: "Файл",
  published: false,
  ...over,
});

const ФАЙЛ = "http://portal/api/public/v1/documents/opisanie-izdeliya-vedal-r1-r2/file";

async function открытьВкладку(documents: Doc[]) {
  render(<ProductTabs product={product} documents={documents} lang="ru" />);
  await userEvent.click(screen.getByRole("tab", { name: "Документы" }));
}

describe("документы к изделию", () => {
  it("выложенный файл открывается ссылкой на портал, а не формой", async () => {
    await открытьВкладку([doc({ published: true, file: ФАЙЛ })]);

    const ссылка = screen.getByRole("link", { name: /Описание изделия/ });
    expect(ссылка).toHaveAttribute("href", ФАЙЛ);
    expect(ссылка).toHaveAttribute("target", "_blank");
    expect(ссылка).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("документ без файла ведёт на форму запроса и говорит об этом", async () => {
    await открытьВкладку([doc()]);

    const ссылка = screen.getByRole("link", { name: /Описание изделия/ });
    // next/link в jsdom отдаёт адрес без хвостового слэша — его дописывает
    // сборка (trailingSlash). Проверяем маршрут, а не форму записи.
    expect(ссылка.getAttribute("href")).toMatch(/^\/contacts\/?$/);
    expect(ссылка).not.toHaveAttribute("target");
    expect(ссылка).toHaveTextContent("выдаётся по запросу");
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
      .filter((t) => t.includes("удостоверение") || t.includes("Описание"));
    expect(названия).toHaveLength(2);
    expect(названия[0]).toContain("Регистрационное удостоверение");
    expect(названия[0]).toContain("согласуется");
  });
});
