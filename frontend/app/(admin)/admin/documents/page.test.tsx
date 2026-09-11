import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Проверка на конкретную поломку: карточка документа переиспользовалась
// при переключении между документами, useState не переинициализировался,
// и «Сохранить» писал поля первого документа под идентификатором второго.
//
// Тест держит `key` на месте. Без него он краснеет — а поломка тихая:
// в интерфейсе на неё ничто не указывает.

const updateDocument = vi.fn();
const reindexKnowledge = vi.fn();

vi.mock("@/lib/admin", () => ({
  documents: vi.fn(),
  documentVocabulary: vi.fn(),
  knowledge: vi.fn(),
  reindexKnowledge: (...args: unknown[]) => reindexKnowledge(...args),
  updateDocument: (...args: unknown[]) => updateDocument(...args),
  createDocument: vi.fn(),
  publishDocument: vi.fn(),
  uploadDocumentFile: vi.fn(),
  AdminError: class AdminError extends Error {},
}));

import { documentVocabulary, documents, knowledge } from "@/lib/admin";
import DocumentsPage from "./page";

function row(overrides: Record<string, unknown>) {
  return {
    id: "id-1",
    version: 3,
    slug: "vedal-product-catalog",
    title: "Каталог продукции VEDAL",
    group: "Коммерческие материалы",
    subject: "ООО «ВЕДАЛ»",
    productSlug: null,
    sensitivity: "public",
    access: "on_request",
    listed: true,
    published: false,
    hasFile: false,
    fileSize: null,
    revision: null,
    approvedBy: null,
    updatedAt: "2026-08-13T10:00:00Z",
    publishBlockedBy: "Файл не загружен",
    ...overrides,
  };
}

const ONE = row({});
const TWO = row({ id: "id-2", version: 7, slug: "sertifikat", title: "Сертификат ISO 13485" });

const ИНДЕКС_ВЫКЛЮЧЕН = { enabled: false, sources: 0, chunks: 0, rows: [] };

beforeEach(() => {
  updateDocument.mockReset().mockResolvedValue(TWO);
  reindexKnowledge.mockReset().mockResolvedValue(ИНДЕКС_ВЫКЛЮЧЕН);
  vi.mocked(knowledge).mockResolvedValue(ИНДЕКС_ВЫКЛЮЧЕН as never);
  vi.mocked(documents).mockResolvedValue([ONE, TWO] as never);
  vi.mocked(documentVocabulary).mockResolvedValue({
    groups: ["Техническая документация", "Система качества", "Коммерческие материалы", "О компании"],
    sensitivities: ["public", "internal", "confidential"],
    access: ["pdf", "on_request", "pending"],
  } as never);
});

describe("страница документов", () => {
  it("показывает поля того документа, который открыт сейчас", async () => {
    const user = userEvent.setup();
    render(<DocumentsPage />);

    await user.click(await screen.findByRole("button", { name: "Правка карточки: Каталог продукции VEDAL" }));
    expect(await screen.findByDisplayValue("vedal-product-catalog")).toBeInTheDocument();

    // Переключаемся на второй документ, не закрывая карточку.
    await user.click(screen.getByRole("button", { name: "Правка карточки: Сертификат ISO 13485" }));

    await waitFor(() => expect(screen.getByDisplayValue("sertifikat")).toBeInTheDocument());
    expect(screen.queryByDisplayValue("vedal-product-catalog")).not.toBeInTheDocument();
  });

  it("сохраняет второй документ его собственными полями и его версией", async () => {
    const user = userEvent.setup();
    render(<DocumentsPage />);

    await user.click(await screen.findByRole("button", { name: "Правка карточки: Каталог продукции VEDAL" }));
    await screen.findByDisplayValue("vedal-product-catalog");
    await user.click(screen.getByRole("button", { name: "Правка карточки: Сертификат ISO 13485" }));
    await screen.findByDisplayValue("sertifikat");

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(updateDocument).toHaveBeenCalled());
    const [id, form] = updateDocument.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe("id-2");
    expect(form.slug).toBe("sertifikat");
    // Версия — вторая линия защиты от затирания чужой правки, и она обязана
    // принадлежать тому же документу, что и остальные поля.
    expect(form.version).toBe(7);
  });

  it("объясняет, почему документ нельзя опубликовать, до нажатия", async () => {
    render(<DocumentsPage />);

    expect(await screen.findAllByText("Файл не загружен")).not.toHaveLength(0);
    const publish = (await screen.findAllByRole("button", { name: "Опубликовать" }))[0];
    expect(publish).toBeDisabled();
  });
});

// Индекс Ведалины. Главное здесь — различать «индекс пуст» и «индексация
// выключена»: в обоих случаях Ведалина не находит документ по близости,
// но в первом кнопка помогает, а во втором она бессмысленна и стоила бы
// вызовов модели.
describe("индекс Ведалины на странице документов", () => {
  it("не предлагает кнопку, пока индексация выключена", async () => {
    render(<DocumentsPage />);

    expect(await screen.findByText(/Индекс по PDF пока выключен/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Переиндексировать" })).not.toBeInTheDocument();
    // «Не в индексе» верно у всех документов сразу и потому не значит ничего.
    expect(screen.queryByText("не в индексе Ведалины")).not.toBeInTheDocument();
  });

  it("показывает у документа, ищет ли по нему Ведалина", async () => {
    vi.mocked(knowledge).mockResolvedValue({
      enabled: true,
      sources: 1,
      chunks: 4,
      rows: [
        {
          kind: "document",
          externalId: "vedal-product-catalog",
          title: "Каталог продукции VEDAL",
          chunks: 4,
          indexedAt: "2026-09-08T10:00:00Z",
        },
      ],
    } as never);

    render(<DocumentsPage />);

    expect(await screen.findByText(/Ведалина ищет по нему/)).toBeInTheDocument();
    // Второй документ в индекс не попал — и это видно, а не скрыто пустотой.
    expect(screen.getByText("не в индексе Ведалины")).toBeInTheDocument();
  });

  it("собирает индекс по нажатию и гасит кнопку на время сборки", async () => {
    const user = userEvent.setup();
    vi.mocked(knowledge).mockResolvedValue({
      enabled: true,
      sources: 0,
      chunks: 0,
      rows: [],
    } as never);
    // Второе нажатие означало бы второй прогон и второй счёт за эмбеддинги,
    // а не «побыстрее».
    let отпустить: () => void = () => {};
    reindexKnowledge.mockReturnValue(
      new Promise((resolve) => {
        отпустить = () => resolve({ enabled: true, sources: 1, chunks: 4, rows: [] });
      }),
    );

    render(<DocumentsPage />);
    await user.click(await screen.findByRole("button", { name: "Переиндексировать" }));

    expect(reindexKnowledge).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Собираем…" })).toBeDisabled();

    отпустить();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Переиндексировать" })).toBeEnabled(),
    );
  });
});
