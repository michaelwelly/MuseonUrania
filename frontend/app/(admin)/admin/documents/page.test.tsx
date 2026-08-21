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

vi.mock("@/lib/admin", () => ({
  documents: vi.fn(),
  documentVocabulary: vi.fn(),
  updateDocument: (...args: unknown[]) => updateDocument(...args),
  createDocument: vi.fn(),
  publishDocument: vi.fn(),
  uploadDocumentFile: vi.fn(),
  AdminError: class AdminError extends Error {},
}));

import { documentVocabulary, documents } from "@/lib/admin";
import DocumentsPage from "./page";

function row(overrides: Record<string, unknown>) {
  return {
    id: "id-1",
    version: 3,
    slug: "licenziya",
    title: "Лицензия на производство",
    group: "Лицензирование",
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

beforeEach(() => {
  updateDocument.mockReset().mockResolvedValue(TWO);
  vi.mocked(documents).mockResolvedValue([ONE, TWO] as never);
  vi.mocked(documentVocabulary).mockResolvedValue({
    groups: ["Лицензирование", "Система качества"],
    sensitivities: ["public", "internal", "confidential"],
    access: ["pdf", "on_request", "pending"],
  } as never);
});

describe("страница документов", () => {
  it("показывает поля того документа, который открыт сейчас", async () => {
    const user = userEvent.setup();
    render(<DocumentsPage />);

    await user.click(await screen.findByRole("button", { name: "Правка карточки: Лицензия на производство" }));
    expect(await screen.findByDisplayValue("licenziya")).toBeInTheDocument();

    // Переключаемся на второй документ, не закрывая карточку.
    await user.click(screen.getByRole("button", { name: "Правка карточки: Сертификат ISO 13485" }));

    await waitFor(() => expect(screen.getByDisplayValue("sertifikat")).toBeInTheDocument());
    expect(screen.queryByDisplayValue("licenziya")).not.toBeInTheDocument();
  });

  it("сохраняет второй документ его собственными полями и его версией", async () => {
    const user = userEvent.setup();
    render(<DocumentsPage />);

    await user.click(await screen.findByRole("button", { name: "Правка карточки: Лицензия на производство" }));
    await screen.findByDisplayValue("licenziya");
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
