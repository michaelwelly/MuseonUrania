import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Главное правило КП: правится только черновик. Отправленное лежит у клиента
// в почте, и правка задним числом означала бы, что портал и клиент держат
// разные версии одного предложения.
//
// Портал это правило держит сам. Тест сторожит, что интерфейс его не обходит:
// у отправленного КП формы правки нет вовсе, а не «есть, но сохранение упадёт».

const mocks = vi.hoisted(() => ({
  AdminError: class AdminError extends Error {},
  quote: vi.fn(),
  updateQuote: vi.fn(),
  sendQuote: vi.fn(),
  decideQuote: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  AdminError: mocks.AdminError,
  quote: mocks.quote,
  updateQuote: mocks.updateQuote,
  sendQuote: mocks.sendQuote,
  decideQuote: mocks.decideQuote,
}));

import QuoteCard from "./page";

const ITEM = {
  productSlug: "vedal-r1-r2",
  name: "Реанимационная система VEDAL R2",
  quantity: 2,
  unitPrice: 1250000,
  amount: 2500000,
};

function quote(overrides: Record<string, unknown> = {}) {
  return {
    id: "quote-1",
    version: 2,
    dealId: "deal-1",
    dealTitle: "Поставка двух систем VEDAL R2",
    number: "КП-000012",
    status: "draft",
    total: 2500000,
    currency: "RUB",
    validUntil: "2026-09-30",
    note: null,
    items: [ITEM],
    sentAt: null,
    decidedAt: null,
    createdAt: "2026-08-10T09:00:00Z",
    updatedAt: "2026-08-12T09:00:00Z",
    ...overrides,
  };
}

// Маршрут отдаёт params обещанием, и страница разворачивает его через `use`,
// то есть приостанавливается. Приостановку надо дождаться внутри act, иначе
// тест видит вечный fallback и падает на пустом теле документа.
async function open() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <QuoteCard params={Promise.resolve({ id: "quote-1" })} />
      </Suspense>,
    );
  });
}

beforeEach(() => {
  mocks.quote.mockReset().mockResolvedValue(quote());
  mocks.updateQuote.mockReset().mockResolvedValue(quote({ version: 3 }));
  mocks.sendQuote.mockReset().mockResolvedValue(quote({ status: "sent" }));
  mocks.decideQuote.mockReset().mockResolvedValue(quote({ status: "accepted" }));
});

describe("карточка КП", () => {
  it("черновик правится и уходит с версией прочитанного", async () => {
    const user = userEvent.setup();
    await open();

    await screen.findByDisplayValue("Реанимационная система VEDAL R2");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(mocks.updateQuote).toHaveBeenCalled());
    const [id, form] = mocks.updateQuote.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe("quote-1");
    expect(form.version).toBe(2);
    expect(form.items).toHaveLength(1);
  });

  it("у отправленного КП формы правки нет вовсе", async () => {
    mocks.quote.mockResolvedValue(
      quote({ status: "sent", sentAt: "2026-08-13T10:00:00Z" }),
    );
    await open();

    // Позиция видна как текст таблицы, но не как поле ввода.
    expect(await screen.findByText("Реанимационная система VEDAL R2")).toBeInTheDocument();
    expect(
      screen.queryByDisplayValue("Реанимационная система VEDAL R2"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Сохранить" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Добавить позицию" })).not.toBeInTheDocument();
  });

  it("решение клиента отмечается только у отправленного", async () => {
    const user = userEvent.setup();
    mocks.quote.mockResolvedValue(quote({ status: "sent", sentAt: "2026-08-13T10:00:00Z" }));
    await open();

    await user.click(await screen.findByRole("button", { name: "Клиент принял" }));

    await waitFor(() => expect(mocks.decideQuote).toHaveBeenCalledWith("quote-1", "accepted"));
  });

  it("у принятого КП решение переспрашивать уже не предлагают", async () => {
    mocks.quote.mockResolvedValue(
      quote({ status: "accepted", sentAt: "2026-08-13T10:00:00Z", decidedAt: "2026-08-14T10:00:00Z" }),
    );
    await open();

    await screen.findByText("Реанимационная система VEDAL R2");
    expect(screen.queryByRole("button", { name: "Клиент принял" })).not.toBeInTheDocument();
  });

  it("пустой черновик не предлагает отправить", async () => {
    mocks.quote.mockResolvedValue(quote({ items: [], total: null }));
    await open();

    const send = await screen.findByRole("button", { name: "Отметить отправленным" });
    // Портал откажет отправить пустое КП. Показать это до нажатия дешевле,
    // чем после: отказ приходит уже после того, как человек решил, что отправил.
    expect(send).toBeDisabled();
  });
});
