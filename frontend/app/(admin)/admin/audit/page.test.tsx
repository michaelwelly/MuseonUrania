import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Журнал.
//
// Что здесь ломается молча.
//
// Словарь фраз. Он написан руками, а коды событий заводит бэкенд. Стоит
// появиться новому — `deal.merged`, — и словарь о нём не знает. Показать
// на этом месте пустоту значит потерять запись: строка есть, а что
// произошло, неизвестно. Незнакомый код обязан показаться сырым.
//
// Портал и посетитель. Записи «public» и «portal» оставил не сотрудник,
// и искать такого в справочнике бесполезно. Если интерфейс этого не знает,
// он покажет «public» как логин человека — и разбор случая пойдёт по ложному
// следу.
//
// Пометка опасного. Уничтожение персональных данных и отказ в доступе
// к закрытому файлу ищут первыми. Если они выглядят как обычная правка
// каталога, их найдут последними.

const mocks = vi.hoisted(() => ({ audit: vi.fn() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/lib/admin", () => ({
  AdminError: class AdminError extends Error {},
  audit: mocks.audit,
  staff: () =>
    Promise.resolve([
      { login: "i.koltsova", name: "Ирина Кольцова", enabled: true },
      { login: "a.rogov", name: "Антон Рогов", enabled: true },
    ]),
}));

import AuditPage from "./page";

function запись(id: string, actor: string, action: string, subject = "product") {
  return {
    id,
    at: "2026-08-21T09:30:00Z",
    actor,
    action,
    subject,
    subjectId: "11111111-2222-3333-4444-555555555555",
    correlationId: null,
    ip: "10.0.0.5",
    payload: null,
  };
}

const ЗАПИСИ = [
  запись("a1", "i.koltsova", "product.unpublish"),
  запись("a2", "a.rogov", "lead.erased", "lead"),
  запись("a3", "public", "document.access.denied", "document"),
  запись("a4", "i.koltsova", "deal.merged", "deal"),
];

beforeEach(() => {
  mocks.audit.mockReset().mockResolvedValue({
    items: ЗАПИСИ,
    page: 0,
    size: 50,
    total: 4,
    pages: 1,
  });
});

async function журнал() {
  render(<AuditPage />);
  await screen.findByText("Снял изделие с публикации — с сайта оно исчезло");
}

function строка(текст: string) {
  return screen.getByText(текст).closest("tr")!;
}

describe("что сделал", () => {
  it("показывает и фразу, и код — они нужны разным читателям", async () => {
    await журнал();

    const тр = строка("Снял изделие с публикации — с сайта оно исчезло");
    // Код нужен тому, кто разбирает случай и ищет по нему в логах.
    expect(within(тр).getByText("product.unpublish")).toBeTruthy();
  });

  it("незнакомый код показывает сырым, а не пустотой", async () => {
    await журнал();

    // Бэкенд заводит коды сам. Пустое место на месте нового означало бы
    // потерянную запись: строка есть, а что произошло — неизвестно.
    expect(screen.getAllByText("deal.merged").length).toBeGreaterThan(0);
  });
});

describe("пометка опасного", () => {
  it("уничтожение персональных данных помечено полосой и цветом", async () => {
    await журнал();

    const тр = строка("Уничтожил персональные данные заявки");
    expect(тр.className).toContain("row--stop");
    expect(тр.querySelector(".did--danger")).toBeTruthy();
  });

  it("обычная правка каталога не помечена", async () => {
    await журнал();

    // Журнал, где подсвечена каждая вторая строка, не подсвечивает ничего.
    //
    // Незнакомый код стоит в строке дважды — фразой и кодом, — поэтому
    // ищем именно фразу: getByText нашёл бы оба и не смог выбрать.
    const фраза = screen.getAllByText("deal.merged").find((n) =>
      n.className.includes("did"),
    )!;
    expect(фраза.closest("tr")!.className).not.toContain("row--stop");
  });

  it("снятие с публикации помечено вниманием, но не опасностью", async () => {
    await журнал();

    const тр = строка("Снял изделие с публикации — с сайта оно исчезло");
    expect(тр.className).not.toContain("row--stop");
    expect(тр.querySelector(".did--notice")).toBeTruthy();
  });
});

describe("кто оставил запись", () => {
  it("логин сотрудника заменяется именем из справочника", async () => {
    await журнал();

    const тр = строка("Снял изделие с публикации — с сайта оно исчезло");
    expect(within(тр).getByText("Ирина Кольцова")).toBeTruthy();
    // Логин остаётся рядом: по нему ищут в логах.
    expect(within(тр).getByText("i.koltsova")).toBeTruthy();
  });

  it("«public» — не сотрудник, и в справочнике его не ищут", async () => {
    await журнал();

    const тр = строка("Отказ в доступе к закрытому файлу");
    expect(within(тр).getByText("Посетитель сайта")).toBeTruthy();
    expect(within(тр).getByText("не сотрудник")).toBeTruthy();
  });
});

describe("отбор", () => {
  it("чип человека шлёт логин, а не имя", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await журнал();

    await user.click(screen.getByRole("button", { name: /Антон Рогов/ }));

    // Портал знает логины, а не имена: имя ушло бы в пустой отбор.
    expect(mocks.audit.mock.calls.at(-1)?.[0]).toEqual({
      subject: "",
      actor: "a.rogov",
    });
  });
});
