import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Доска сделок.
//
// Три вещи, которые ломаются молча и по которым принимают решения.
//
// Число в шапке колонки. Оно должно приходить с портала (`total`), а не
// считаться по загруженным карточкам: колонка показывает первые сорок,
// и «40» на стадии, где сделок сто, — это не ошибка отрисовки, а неверный
// ответ на вопрос «сколько у нас в переговорах».
//
// Сумма колонки. Сумма по сорока карточкам из ста выглядит ровно как сумма
// стадии и читается как она же. Поэтому при усечении суммы нет вовсе.
//
// Пустая колонка. Стадия, которая не ответила, выглядит точно так же, как
// стадия, в которой ничего нет. Разница — в том, что по первой нельзя
// делать выводы, и портал обязан сказать об этом словами.

const mocks = vi.hoisted(() => ({
  deals: vi.fn(),
  moveDeal: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/admin", () => ({
  AdminError: class AdminError extends Error {},
  deals: mocks.deals,
  moveDeal: mocks.moveDeal,
  pipelines: () =>
    Promise.resolve([
      {
        pipeline: "sales",
        stages: ["new", "qualified", "quoted", "won", "lost"],
        wonStages: ["won"],
        lostStages: ["lost"],
      },
      {
        pipeline: "service",
        stages: ["new", "diagnostics", "repair", "closed"],
        wonStages: ["closed"],
        lostStages: ["declined"],
      },
    ]),
}));

import DealsPage from "./page";
import { ToastHost } from "../Toast";

function deal(id: string, title: string, stage: string, amount: number | null) {
  return {
    id,
    clientId: "c1",
    clientName: "Областной перинатальный центр",
    pipeline: "sales",
    title,
    stage,
    amount,
    currency: "RUB",
    productSlug: "vedal-r2",
    owner: "irina",
    createdAt: "2026-08-01T09:00:00Z",
    updatedAt: "2026-08-19T09:00:00Z",
  };
}

function page(items: unknown[], total = items.length) {
  return { items, page: 0, size: 40, total, pages: 1 };
}

/** По умолчанию: две сделки в «новая», одна в «выставлено КП», остальное пусто. */
function обычно() {
  mocks.deals.mockImplementation((filter: { stage?: string }) => {
    if (filter.stage === "new") {
      return Promise.resolve(
        page([deal("d1", "Две системы R2", "new", 2650000), deal("d2", "Одна R1", "new", 900000)]),
      );
    }
    if (filter.stage === "quoted") {
      return Promise.resolve(page([deal("d3", "Реанимация", "quoted", 4100000)]));
    }
    if (!filter.stage) {
      // Список спрашивает без стадии — ему отдаётся всё сразу.
      return Promise.resolve(
        page([
          deal("d1", "Две системы R2", "new", 2650000),
          deal("d3", "Реанимация", "quoted", 4100000),
        ]),
      );
    }
    return Promise.resolve(page([]));
  });
}

beforeEach(() => {
  window.localStorage.clear();
  mocks.push.mockReset();
  mocks.moveDeal.mockReset().mockResolvedValue({});
  mocks.deals.mockReset();
  обычно();
});

async function доска() {
  const user = userEvent.setup();
  render(
    <ToastHost>
      <DealsPage />
    </ToastHost>,
  );
  await screen.findByText("Две системы R2");
  return user;
}

/** Колонка по названию стадии. */
function колонка(name: string) {
  return screen.getByRole("region", { name: new RegExp("^" + name) });
}

describe("доска", () => {
  it("спрашивает каждую стадию отдельно, а не одну страницу на всё", async () => {
    await доска();

    // Пять стадий — пять запросов, у каждого своя стадия. Одна страница
    // на всю воронку означала бы, что в дальних колонках пусто не потому,
    // что там пусто, а потому что страница кончилась.
    const стадии = mocks.deals.mock.calls.map((c) => (c[0] as { stage: string }).stage);
    expect(new Set(стадии)).toEqual(
      new Set(["new", "qualified", "quoted", "won", "lost"]),
    );
  });

  it("число в шапке колонки берётся с портала, а не считается по карточкам", async () => {
    mocks.deals.mockImplementation((filter: { stage?: string }) =>
      Promise.resolve(
        filter.stage === "new"
          ? page([deal("d1", "Две системы R2", "new", 2650000)], 34)
          : page([]),
      ),
    );

    await доска();

    // На экране одна карточка, а на стадии тридцать четыре сделки.
    expect(within(колонка("новая")).getByText("34")).toBeTruthy();
  });

  it("при усечении колонки суммы нет — вместо неё сказано, сколько видно", async () => {
    mocks.deals.mockImplementation((filter: { stage?: string }) =>
      Promise.resolve(
        filter.stage === "new"
          ? page([deal("d1", "Две системы R2", "new", 2650000)], 34)
          : page([]),
      ),
    );

    await доска();

    const шапка = колонка("новая");
    expect(within(шапка).getByText("показаны 1 из 34")).toBeTruthy();
    // На карточке сумма сделки есть и остаётся: врёт не она, а сумма стадии.
    expect(шапка.querySelector(".board__sum")?.textContent).toBe("показаны 1 из 34");
  });

  it("когда видно всё — сумма колонки настоящая", async () => {
    await доска();

    // 2 650 000 + 900 000
    // toLocaleString разделяет разряды неразрывным пробелом (U+00A0),
    // и сравнение с обычным пробелом падает на строках, которые выглядят
    // одинаково. Приводим пробелы к одному виду.
    const сумма = (колонка("новая").querySelector(".board__sum")?.textContent ?? "")
      .replace(/[  ]/g, " ");
    expect(сумма).toBe("3 550 000,00 RUB");
  });

  it("не ответившая стадия названа словами, а не пустой колонкой", async () => {
    mocks.deals.mockImplementation((filter: { stage?: string }) => {
      if (filter.stage === "quoted") return Promise.reject(new Error("портал отказал"));
      // Сделка ровно в одной стадии: одинаковые карточки в четырёх колонках
      // сделали бы поиск по названию неоднозначным.
      return Promise.resolve(
        filter.stage === "new"
          ? page([deal("d1", "Две системы R2", "new", 2650000)])
          : page([]),
      );
    });

    await доска();

    expect(
      await screen.findByText(/Не удалось прочитать 1 стадию/),
    ).toBeTruthy();
  });
});

describe("перенос карточки", () => {
  it("в обычную стадию идёт сразу и оставляет отмену", async () => {
    await доска();

    fireEvent.dragStart(screen.getByText("Две системы R2").closest("a")!);
    fireEvent.drop(колонка("квалифицирована"));

    await waitFor(() => expect(mocks.moveDeal).toHaveBeenCalledWith("d1", "qualified", null));
    expect(await screen.findByRole("button", { name: "Отменить" })).toBeTruthy();
  });

  it("отмена возвращает прежнюю стадию", async () => {
    await доска();

    fireEvent.dragStart(screen.getByText("Две системы R2").closest("a")!);
    fireEvent.drop(колонка("квалифицирована"));
    await waitFor(() => expect(mocks.moveDeal).toHaveBeenCalledTimes(1));

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Отменить" }));

    await waitFor(() => expect(mocks.moveDeal).toHaveBeenCalledWith("d1", "new", null));
  });

  it("в отказ не переносит, пока не названа причина", async () => {
    const user = await доска();

    fireEvent.dragStart(screen.getByText("Две системы R2").closest("a")!);
    fireEvent.drop(колонка("проиграна"));

    // Причина — требование домена: без неё портал откажет, и сделка
    // осталась бы на месте без объяснения.
    expect(await screen.findByRole("dialog", { name: /проиграна/ })).toBeTruthy();
    expect(mocks.moveDeal).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Причина"), "Выбрали другого поставщика");
    await user.click(screen.getByRole("button", { name: "Перевести в отказ" }));

    await waitFor(() =>
      expect(mocks.moveDeal).toHaveBeenCalledWith("d1", "lost", "Выбрали другого поставщика"),
    );
  });

  it("отмена вопроса о причине оставляет сделку на месте", async () => {
    const user = await доска();

    fireEvent.dragStart(screen.getByText("Две системы R2").closest("a")!);
    fireEvent.drop(колонка("проиграна"));
    await screen.findByRole("dialog", { name: /проиграна/ });

    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(mocks.moveDeal).not.toHaveBeenCalled();
  });

  it("бросок в ту же колонку ничего не делает", async () => {
    await доска();

    fireEvent.dragStart(screen.getByText("Две системы R2").closest("a")!);
    fireEvent.drop(колонка("новая"));

    expect(mocks.moveDeal).not.toHaveBeenCalled();
  });
});

describe("воронки и виды", () => {
  it("смена воронки читает её стадии, а не стадии прошлой", async () => {
    const user = await доска();
    mocks.deals.mockClear();

    await user.click(screen.getByRole("radio", { name: "сервис" }));

    await waitFor(() => {
      const стадии = mocks.deals.mock.calls.map((c) => (c[0] as { stage: string }).stage);
      expect(new Set(стадии)).toEqual(new Set(["new", "diagnostics", "repair", "closed"]));
    });
  });

  it("список — это другой вид, а не другой отбор", async () => {
    const user = await доска();

    await user.click(screen.getByRole("radio", { name: "Список" }));

    // В списке колонок стадий нет, есть таблица со столбцом «Стадия».
    expect(screen.queryByRole("region", { name: /^новая/ })).toBeNull();
    expect(await screen.findByRole("columnheader", { name: "Стадия" })).toBeTruthy();
  });
});
