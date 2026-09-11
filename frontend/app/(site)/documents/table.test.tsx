import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Doc } from "@/lib/api";
import DocumentsTable from "./table";

// Перечень документов. Issue #73.
//
// Проверяется не вёрстка, а обещание строки: бейдж «Файл» стоит только там,
// где файл действительно выложен, и строка без файла ведёт на форму.

const doc = (over: Partial<Doc> = {}): Doc => ({
  slug: "vedal-product-catalog",
  title: "Каталог продукции VEDAL",
  group: "Коммерческие материалы",
  product: "Все изделия",
  productSlug: null,
  access: "Файл",
  published: false,
  ...over,
});

const ФАЙЛ = "http://portal/api/public/v1/documents/vedal-certificate-conformity/file";

/**
 * Адрес строки разобранным. Сравнивать его целой строкой значит зависеть
 * от порядка параметров, а он к делу не относится.
 */
const адрес = (a: HTMLElement) => new URL(a.getAttribute("href")!, "http://vedal.test");

describe("перечень документов", () => {
  it("строка с файлом ведёт на файл и подписана «Скачать»", () => {
    render(
      <DocumentsTable
        documents={[
          doc({
            slug: "vedal-certificate-conformity",
            title: "Сертификат соответствия ООО «ВЕДАЛ»",
            published: true,
            file: ФАЙЛ,
          }),
        ]}
      />,
    );

    const строка = screen.getByRole("link", { name: /Сертификат соответствия/ });
    expect(строка).toHaveAttribute("href", ФАЙЛ);
    expect(строка).toHaveAttribute("download");
    expect(строка).not.toHaveAttribute("target");
    expect(строка).toHaveTextContent("Скачать");
    expect(строка).toHaveTextContent("Файл");
  });

  it("строка без файла ведёт в форму с выбранной темой", () => {
    render(<DocumentsTable documents={[doc()]} />);

    const строка = screen.getByRole("link", { name: /Каталог продукции VEDAL/ });
    // next/link в jsdom отдаёт адрес без хвостового слэша — его дописывает
    // сборка (trailingSlash). Проверяем маршрут, а не форму записи.
    expect(адрес(строка).pathname).toMatch(/^\/contacts\/?$/);
    // Тема выбрана за человека: раньше он попадал на верх страницы контактов
    // и разбирал список тем сам — нажав кнопку ровно затем, чтобы этого
    // не делать. Якорь доводит до самой формы.
    expect(адрес(строка).searchParams.get("topic")).toBe("catalog");
    expect(адрес(строка).hash).toBe("#lead");
    expect(строка).not.toHaveAttribute("target");
    expect(строка).toHaveTextContent("Запросить");
  });

  // Документ компании к изделию не привязан, и подставить в заявку изделие
  // по человекочитаемому «Все изделия» значит его угадать.
  it("изделие подставляется только там, где документ к нему привязан", () => {
    render(
      <DocumentsTable
        documents={[
          doc(),
          doc({
            slug: "ru-vedal-r1",
            title: "Регистрационное удостоверение",
            productSlug: "vedal-r1",
          }),
        ]}
      />,
    );

    const общий = адрес(screen.getByRole("link", { name: /Каталог продукции VEDAL/ }));
    const изделия = адрес(screen.getByRole("link", { name: /Регистрационное удостоверение/ }));
    expect(общий.searchParams.has("product")).toBe(false);
    expect(изделия.searchParams.get("product")).toBe("vedal-r1");
  });

  // Ровно тот случай, из-за которого заведён issue: намерение выложить файл
  // без файла показывалось бейджем «PDF» и обещало скачивание.
  it("бейдж не обещает файл, которого нет", () => {
    render(<DocumentsTable documents={[doc({ access: "Файл" })]} />);

    expect(screen.getByRole("link", { name: /Каталог продукции VEDAL/ })).toHaveTextContent(
      "По запросу",
    );
  });

  it("«Уточняется» остаётся статусом документа", () => {
    render(<DocumentsTable documents={[doc({ access: "Уточняется" })]} />);

    expect(screen.getByRole("link", { name: /Каталог продукции VEDAL/ })).toHaveTextContent(
      "Уточняется",
    );
  });
});
