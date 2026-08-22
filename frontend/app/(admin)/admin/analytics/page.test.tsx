import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Аналитика.
//
// Единственный вопрос к этому экрану — где теряются заявки, и два способа
// ответить на него неправдой.
//
// Сравнение с прошлым периодом. «На 30% больше» имеет смысл, только если
// прошлый период той же длины и стоит вплотную. Взяв произвольный кусок
// времени, получаем не сравнение, а совпадение — выглядящее ровно так же.
// И сравнивать «всё время» не с чем вовсе: сравнения тогда просто нет.
//
// Полосы пути. Они меряются от числа заявок — общей шкалы, — а не каждая
// от предыдущей. Иначе «выиграно» рисуется во всю ширину рядом со «стали
// сделками», и потеря, ради которой сюда пришли, исчезает с экрана.

const mocks = vi.hoisted(() => ({ analytics: vi.fn() }));

vi.mock("@/lib/admin", () => ({
  AdminError: class AdminError extends Error {},
  analytics: mocks.analytics,
  analyticsDimensions: () => Promise.resolve(["source", "form", "product"]),
}));

import AnalyticsPage from "./page";

function отчёт(leads: number, deals: number, won: number, lost: number) {
  return {
    by: "source",
    from: null,
    to: null,
    rows: [{ key: "site", leads, deals, won, lost, wonAmount: 1000 }],
    totals: { leads, deals, won, lost, wonAmount: 1000 },
  };
}

beforeEach(() => {
  mocks.analytics.mockReset().mockResolvedValue(отчёт(100, 40, 10, 5));
});

async function экран() {
  const user = userEvent.setup();
  render(<AnalyticsPage />);
  await screen.findByText("Путь заявки");
  return user;
}

describe("плитки", () => {
  it("показывают то, что посчитал портал", async () => {
    await экран();

    // textContent, а не innerText: jsdom последнего не знает вовсе,
    // и проверка молча сравнивала бы undefined.
    const плитки = [...document.querySelectorAll(".tile")].map((t) =>
      (t.textContent ?? "").replace(/\s+/g, " "),
    );
    expect(плитки[0]).toContain("100");
    expect(плитки[1]).toContain("40");
    expect(плитки[3]).toContain("10%");
  });

  it("без периода сравнивать не с чем — и сравнения нет", async () => {
    await экран();

    // Второго запроса не было: сравнивать «всё время» не с чем.
    expect(mocks.analytics).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".tile__delta")).toBeNull();
  });
});

describe("сравнение с прошлым периодом", () => {
  it("берёт период той же длины вплотную к заданному", async () => {
    const user = await экран();

    await user.type(screen.getByLabelText("Начало периода"), "2026-08-11");
    await user.type(screen.getByLabelText("Конец периода"), "2026-08-20");

    // Заданы десять дней с 11 по 20. Прошлые десять — с 1 по 10:
    // той же длины и вплотную, без зазора и без нахлёста.
    await waitFor(() => {
      const звали = mocks.analytics.mock.calls.map((c) => c.slice(1).join("…"));
      expect(звали).toContain("2026-08-01…2026-08-10");
    });
  });

  it("говорит, с чем сравнивает, а не сравнивает молча", async () => {
    const user = await экран();

    await user.type(screen.getByLabelText("Начало периода"), "2026-08-11");
    await user.type(screen.getByLabelText("Конец периода"), "2026-08-20");

    expect(await screen.findByText(/сравнение с 01\.08\.2026 — 10\.08\.2026/)).toBeTruthy();
  });

  it("падение и рост названы по-разному", async () => {
    mocks.analytics.mockImplementation((_by: string, from: string) =>
      Promise.resolve(from === "2026-08-01" ? отчёт(150, 40, 10, 5) : отчёт(100, 40, 10, 5)),
    );

    const user = await экран();
    await user.type(screen.getByLabelText("Начало периода"), "2026-08-11");
    await user.type(screen.getByLabelText("Конец периода"), "2026-08-20");

    // Было 150, стало 100 — падение на 50, и это должно быть видно словом,
    // а не только цветом.
    const дельта = await screen.findByText(/−50 к прошлому периоду/);
    expect(дельта.className).toContain("tile__delta--down");
  });
});

describe("путь заявки", () => {
  it("полосы меряются от заявок, а не каждая от предыдущей", async () => {
    await экран();

    const полосы = [...document.querySelectorAll(".track")].map((t) => ({
      имя: t.querySelector(".track__name")?.textContent,
      ширина: (t.querySelector(".track__fill") as HTMLElement)?.style.width,
    }));

    // 40 сделок из 100 заявок — сорок процентов общей шкалы. Если бы каждая
    // мерилась от предыдущей, «выиграно» заняло бы четверть полосы сделок
    // и выглядело бы крупнее, чем есть.
    expect(полосы).toEqual([
      { имя: "Пришло заявок", ширина: "100%" },
      { имя: "Стали сделками", ширина: "40%" },
      { имя: "Выиграно", ширина: "10%" },
      { имя: "Проиграно", ширина: "5%" },
    ]);
  });

  it("проигранное помечено отдельно от выигранного", async () => {
    await экран();

    const проиграно = [...document.querySelectorAll(".track")].find((t) =>
      t.querySelector(".track__name")?.textContent?.includes("Проиграно"),
    )!;
    expect(проиграно.querySelector(".track__fill--stop")).toBeTruthy();
  });
});

describe("таблица разреза", () => {
  it("итоговая строка помечена, а не теряется среди одинаковых", async () => {
    await экран();

    const итог = document.querySelector("tr.row--total")!;
    expect(within(итог as HTMLElement).getByText("Итого")).toBeTruthy();
  });

  it("конверсия при нуле заявок — прочерк, а не ноль процентов", async () => {
    mocks.analytics.mockResolvedValue({
      by: "source",
      from: null,
      to: null,
      rows: [{ key: "email", leads: 0, deals: 0, won: 0, lost: 0, wonAmount: null }],
      totals: { leads: 0, deals: 0, won: 0, lost: 0, wonAmount: null },
    });

    await экран();

    // Ноль из нуля не равен нулю, он не считается вовсе.
    const строка = screen.getByText("почта").closest("tr")!;
    expect(within(строка).getAllByText("—").length).toBeGreaterThan(0);
  });
});
