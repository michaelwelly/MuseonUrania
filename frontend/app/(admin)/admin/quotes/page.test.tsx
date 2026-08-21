import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Список КП.
//
// Проверяется одно: строка называет действие, а не «открыть». У КП пять
// состояний, и в каждом от человека требуется своё — черновик дописать,
// отправленное дождаться и отметить, истекшее составить заново. Одинаковая
// подпись на всех пяти заставляет открыть, чтобы узнать, зачем открыли,
// и ошибка здесь не видна: список выглядит совершенно исправным.

const mocks = vi.hoisted(() => ({ quotes: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("@/lib/admin", () => ({
  AdminError: class AdminError extends Error {},
  quotes: mocks.quotes,
}));

import QuotesPage from "./page";

function quote(id: string, number: string, status: string) {
  return {
    id,
    dealId: "deal-1",
    dealTitle: "Поставка двух систем",
    number,
    status,
    total: 2650000,
    currency: "RUB",
    validUntil: "2026-09-01",
    sentAt: status === "draft" ? null : "2026-08-15T09:00:00Z",
    createdAt: "2026-08-10T09:00:00Z",
  };
}

const ЧЕТЫРЕ = [
  quote("q1", "КП-001", "draft"),
  quote("q2", "КП-002", "sent"),
  quote("q3", "КП-003", "accepted"),
  quote("q4", "КП-004", "expired"),
];

beforeEach(() => {
  mocks.quotes.mockReset().mockImplementation((_status: string, _page = 0, size = 50) =>
    Promise.resolve(
      size === 1
        ? { items: [], page: 0, size: 1, total: 8, pages: 8 }
        : { items: ЧЕТЫРЕ, page: 0, size: 50, total: 4, pages: 1 },
    ),
  );
});

async function список() {
  render(<QuotesPage />);
  await screen.findByText("КП-001");
}

/** Строка по номеру КП. */
function строка(number: string) {
  return screen.getByText(number).closest("tr")!;
}

describe("список КП", () => {
  it("в каждой строке названо то, чего она ждёт", async () => {
    await список();

    expect(within(строка("КП-001")).getByText("Дописать")).toBeTruthy();
    expect(within(строка("КП-002")).getByText("Отметить решение")).toBeTruthy();
    expect(within(строка("КП-003")).getByText("Открыть")).toBeTruthy();
    expect(within(строка("КП-004")).getByText("Составить заново")).toBeTruthy();
  });

  it("подпись действия называет КП, а не висит безымянной ссылкой", async () => {
    await список();

    // Обход с клавиатуры давал бы четыре «Дописать» подряд без указания,
    // к какому КП каждая относится.
    expect(screen.getByRole("link", { name: "Дописать: КП КП-001" })).toBeTruthy();
  });

  it("истекшее помечено полосой, а не только словом", async () => {
    await список();

    // В списке из тридцати строк слово «истекло» находится чтением,
    // а полоса — взглядом.
    expect(строка("КП-004").className).toContain("row--stop");
    expect(строка("КП-002").className).not.toContain("row--stop");
  });

  it("счётчик чипа просит одну строку, а не страницу", async () => {
    await список();

    // Чипу нужен только total. Запрос страницы ради числа — это пять
    // выгрузок списка на каждое открытие экрана.
    const счётчики = mocks.quotes.mock.calls.filter((c) => c[2] === 1);
    expect(счётчики.length).toBe(5);
    expect(screen.getAllByText("8").length).toBe(5);
  });
});
