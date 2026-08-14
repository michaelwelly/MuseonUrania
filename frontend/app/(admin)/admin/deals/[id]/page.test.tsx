import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Карточка сделки. Проверяется то, что ломается молча:
//
// 1. перевод в проигранную стадию без причины — воронка, показывающая,
//    сколько потеряли, и молчащая о том, почему;
// 2. какая стадия проигрышная — по карточке, а не по списку в интерфейсе:
//    свой список разъезжается с доменом молча;
// 3. версия карточки после сохранения — с прошлой версией второе сохранение
//    подряд получает 409, хотя никто, кроме этого редактора, не правил;
// 4. отказ по версии — редактору надо сказать «перечитайте», а не «повторите».

const mocks = vi.hoisted(() => {
  class AdminError extends Error {
    readonly status: number;
    readonly fields?: Record<string, string>;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    AdminError,
    updateDeal: vi.fn(),
    moveDeal: vi.fn(),
    deal: vi.fn(),
    dealQuotes: vi.fn(),
    documents: vi.fn(),
    history: vi.fn(),
    push: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, back: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/admin", () => ({
  AdminError: mocks.AdminError,
  deal: mocks.deal,
  updateDeal: mocks.updateDeal,
  moveDeal: mocks.moveDeal,
  dealQuotes: mocks.dealQuotes,
  documents: mocks.documents,
  history: mocks.history,
  attachToDeal: vi.fn(),
  detachFromDeal: vi.fn(),
  createQuote: vi.fn(),
  addToHistory: vi.fn(),
}));

import DealCard from "./page";

function deal(overrides: Record<string, unknown> = {}) {
  return {
    id: "deal-1",
    version: 4,
    clientId: "client-1",
    clientName: "Областной перинатальный центр",
    leadId: null,
    pipeline: "sales",
    title: "Поставка двух систем VEDAL R2",
    stage: "qualified",
    stages: ["new", "qualified", "quoted", "won", "lost"],
    wonStages: ["won"],
    lostStages: ["lost"],
    amount: 2650000,
    currency: "RUB",
    productSlug: "vedal-r1-r2",
    owner: "editor",
    closedAt: null,
    lostReason: null,
    attachments: [],
    createdAt: "2026-08-01T09:00:00Z",
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
        <DealCard params={Promise.resolve({ id: "deal-1" })} />
      </Suspense>,
    );
  });
}

// Все загрузки карточки перезаводятся здесь, а не в фабрике мока: общий
// afterEach снимает реализации, и со второго теста подряд карточка грузила бы
// undefined вместо обещания.
beforeEach(() => {
  mocks.deal.mockReset().mockResolvedValue(deal());
  mocks.updateDeal.mockReset().mockResolvedValue(deal({ version: 5 }));
  mocks.moveDeal.mockReset().mockResolvedValue(deal({ stage: "lost" }));
  mocks.dealQuotes.mockReset().mockResolvedValue([]);
  mocks.documents.mockReset().mockResolvedValue([]);
  mocks.history.mockReset().mockResolvedValue([]);
  mocks.push.mockReset();
});

describe("карточка сделки", () => {
  it("не даёт перевести в проигранную стадию без причины", async () => {
    const user = userEvent.setup();
    await open();

    await screen.findByDisplayValue("Поставка двух систем VEDAL R2");
    await user.selectOptions(screen.getByLabelText("Стадия"), "lost");

    const move = screen.getByRole("button", { name: "Перевести" });
    expect(move).toBeDisabled();

    // Подсказка поля лежит внутри <label>, и доступное имя поля — это подпись
    // вместе с ней. Отсюда поиск по части имени, а не по точному совпадению.
    await user.type(screen.getByLabelText(/Причина проигрыша/), "Выбрали другого поставщика");
    expect(move).toBeEnabled();

    await user.click(move);
    await waitFor(() => expect(mocks.moveDeal).toHaveBeenCalled());
    expect(mocks.moveDeal.mock.calls[0]).toEqual([
      "deal-1",
      "lost",
      "Выбрали другого поставщика",
    ]);
  });

  it("в выигрышную стадию переводит без причины", async () => {
    const user = userEvent.setup();
    await open();

    await screen.findByDisplayValue("Поставка двух систем VEDAL R2");
    await user.selectOptions(screen.getByLabelText("Стадия"), "won");
    await user.click(screen.getByRole("button", { name: "Перевести" }));

    await waitFor(() => expect(mocks.moveDeal).toHaveBeenCalled());
    expect(mocks.moveDeal.mock.calls[0]).toEqual(["deal-1", "won", null]);
  });

  // Исходы у трёх воронок зовутся по-разному, а четвёртая — правка домена,
  // а не интерфейса. Карточка сама говорит, чем её воронка заканчивается;
  // список, переписанный сюда, промолчал бы на незнакомой стадии и отдал
  // перевод без причины порталу — тот откажет, но уже после нажатия.
  it("спрашивает причину по исходам из карточки, а не по своему списку", async () => {
    const user = userEvent.setup();
    mocks.deal.mockResolvedValue(
      deal({
        pipeline: "tender",
        stage: "new",
        stages: ["new", "submitted", "awarded", "cancelled"],
        wonStages: ["awarded"],
        lostStages: ["cancelled"],
      }),
    );
    await open();

    await screen.findByDisplayValue("Поставка двух систем VEDAL R2");
    const move = screen.getByRole("button", { name: "Перевести" });

    await user.selectOptions(screen.getByLabelText("Стадия"), "cancelled");
    expect(screen.getByLabelText(/Причина проигрыша/)).toBeInTheDocument();
    expect(move).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("Стадия"), "awarded");
    expect(screen.queryByLabelText(/Причина проигрыша/)).not.toBeInTheDocument();
    expect(move).toBeEnabled();
  });

  it("второе сохранение подряд уходит с версией из ответа портала", async () => {
    const user = userEvent.setup();
    await open();

    const title = await screen.findByDisplayValue("Поставка двух систем VEDAL R2");
    const save = screen.getByRole("button", { name: "Сохранить" });

    await user.click(save);
    await waitFor(() => expect(mocks.updateDeal).toHaveBeenCalledTimes(1));
    expect(mocks.updateDeal.mock.calls[0][1].version).toBe(4);

    await user.clear(title);
    await user.type(title, "Поставка трёх систем VEDAL R2");
    await user.click(save);

    await waitFor(() => expect(mocks.updateDeal).toHaveBeenCalledTimes(2));
    // Версия сдвинулась после первого сохранения. Ушла бы прежняя —
    // портал отказал бы по конфликту, которого на самом деле нет.
    expect(mocks.updateDeal.mock.calls[1][1].version).toBe(5);
    expect(mocks.updateDeal.mock.calls[1][1].title).toBe("Поставка трёх систем VEDAL R2");
  });

  it("отказ по версии объясняет, что делать, и закрывает повторное сохранение", async () => {
    const user = userEvent.setup();
    mocks.updateDeal.mockRejectedValue(
      new mocks.AdminError(409, "Сделку уже изменил другой редактор."),
    );
    await open();

    await screen.findByDisplayValue("Поставка двух систем VEDAL R2");
    const save = screen.getByRole("button", { name: "Сохранить" });
    await user.click(save);

    expect(await screen.findByText(/Перечитайте карточку/)).toBeInTheDocument();
    // Повторное нажатие «Сохранить» отправило бы ту же прежнюю версию
    // и получило бы тот же отказ — по кругу, пока человек не решит,
    // что портал сломан.
    expect(save).toBeDisabled();
    expect(screen.getByRole("button", { name: "Перечитать" })).toBeInTheDocument();
  });
});
