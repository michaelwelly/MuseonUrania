import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Doc } from "@/lib/api";
import DocumentsTable from "./table";

// Перечень документов. Issue #73.
//
// Проверяется не вёрстка, а обещание строки: бейдж «Файл» стоит только там,
// где файл действительно выложен, и строка без файла ведёт на форму.

const doc = (over: Partial<Doc> = {}): Doc => ({
  slug: "katalog-produkcii-2026",
  title: "Каталог продукции 2026",
  group: "Коммерческие материалы",
  product: "Все изделия",
  productSlug: null,
  access: "Файл",
  published: false,
  ...over,
});

const ФАЙЛ = "http://portal/api/public/v1/documents/sertifikat-iso-13485/file";

describe("перечень документов", () => {
  it("строка с файлом ведёт на файл и подписана «Открыть»", () => {
    render(
      <DocumentsTable
        documents={[
          doc({ slug: "sertifikat-iso-13485", title: "Сертификат ISO 13485", published: true, file: ФАЙЛ }),
        ]}
        lang="ru"
      />,
    );

    const строка = screen.getByRole("link", { name: /Сертификат ISO 13485/ });
    expect(строка).toHaveAttribute("href", ФАЙЛ);
    expect(строка).toHaveAttribute("target", "_blank");
    expect(строка).toHaveTextContent("Открыть");
    expect(строка).toHaveTextContent("Файл");
  });

  it("строка без файла ведёт на форму и подписана «Запросить»", () => {
    render(<DocumentsTable documents={[doc()]} lang="ru" />);

    const строка = screen.getByRole("link", { name: /Каталог продукции 2026/ });
    // next/link в jsdom отдаёт адрес без хвостового слэша — его дописывает
    // сборка (trailingSlash). Проверяем маршрут, а не форму записи.
    expect(строка.getAttribute("href")).toMatch(/^\/contacts\/?$/);
    expect(строка).not.toHaveAttribute("target");
    expect(строка).toHaveTextContent("Запросить");
  });

  // Ровно тот случай, из-за которого заведён issue: намерение выложить файл
  // без файла показывалось бейджем «PDF» и обещало скачивание.
  it("бейдж не обещает файл, которого нет", () => {
    render(<DocumentsTable documents={[doc({ access: "Файл" })]} lang="ru" />);

    expect(screen.getByRole("link", { name: /Каталог продукции 2026/ })).toHaveTextContent(
      "По запросу",
    );
  });

  it("«Уточняется» остаётся статусом документа", () => {
    render(<DocumentsTable documents={[doc({ access: "Уточняется" })]} lang="ru" />);

    expect(screen.getByRole("link", { name: /Каталог продукции 2026/ })).toHaveTextContent(
      "Уточняется",
    );
  });
});
