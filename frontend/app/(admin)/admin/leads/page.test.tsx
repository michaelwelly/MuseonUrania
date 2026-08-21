import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Экран заявок: отбор, выделение, массовые действия.
//
// Всё, что здесь проверяется, ломается молча и выглядит при этом правдоподобно.
//
// Отбор. Если фильтр перестанет уходить в портал и начнёт отбирать
// загруженную страницу, экран продолжит работать — и продолжит показывать
// правильные ответы ровно до второй страницы. Дальше «ничего не найдено»
// будет означать «на этой странице нет», и отличить одно от другого
// по внешнему виду нельзя.
//
// Массовые действия. У портала нет двери «поменять только ответственного»:
// `triage` ставит статус и ответственного вместе. Значит, каждое массовое
// действие обязано взять недостающее из строки. Ошибка здесь сносит то,
// чего не трогали, — у пятидесяти заявок разом и без единого сообщения.
//
// Выделение. Оно живёт по идентификаторам, а страница меняется. «Выбрано 3»
// на второй странице — это три заявки, которых на ней нет.

const mocks = vi.hoisted(() => ({
  leads: vi.fn(),
  triageLead: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/leads/",
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/admin", () => {
  const page = (items: unknown[], total = items.length) =>
    Promise.resolve({ items, page: 0, size: 50, total, pages: Math.ceil(total / 50) || 1 });

  return {
    NOBODY: "-",
    AdminError: class AdminError extends Error {},
    leads: mocks.leads,
    leadStatuses: () => Promise.resolve(["draft", "new", "in_progress", "won", "lost"]),
    triageLead: mocks.triageLead,
    lead: (id: string) =>
      Promise.resolve({
        id,
        form: "quote",
        name: "Иван Петров",
        company: "ГКБ №1",
        phone: "+7 343 555-22-11",
        email: "ivan@example.ru",
        productSlug: "vedal-r1",
        source: "site",
        status: "new",
        owner: null,
        dealId: null,
        createdAt: "2026-08-20T09:00:00Z",
        message: "Прошу КП на две системы.",
        consentVersion: "v1",
        consentAt: "2026-08-20T09:00:00Z",
        correlationId: null,
        erasedAt: null,
      }),
    clients: () => page([]),
    pipelines: () =>
      Promise.resolve([
        { pipeline: "sales", stages: ["new"], wonStages: ["won"], lostStages: ["lost"] },
      ]),
    convertLead: () => Promise.resolve({ id: "deal-1" }),
    eraseLeadData: () => Promise.resolve({ result: "ok", conversations: "0" }),
    history: () => Promise.resolve([]),
    addToHistory: () => Promise.resolve({}),
    staff: () =>
      Promise.resolve([
        { login: "irina", name: "Ирина Кольцова", enabled: true },
        { login: "anton", name: "Антон Рогов", enabled: true },
      ]),
  };
});

import LeadsPage from "./page";
import { ToastHost } from "../Toast";
import { CountsHost } from "../counts";
import { WhoHost } from "../who";

type Row = {
  id: string;
  name: string;
  company: string | null;
  status: string;
  owner: string | null;
};

function row(id: string, name: string, status: string, owner: string | null): Row {
  return { id, name, company: "ГКБ №" + id, status, owner };
}

/** Полная строка списка из короткой заготовки. */
function full(r: Row) {
  return {
    ...r,
    form: "quote",
    phone: "+7 343 555-22-1" + r.id,
    email: r.id + "@example.ru",
    productSlug: null,
    source: "site",
    dealId: null,
    createdAt: "2026-08-2" + r.id + "T09:00:00Z",
  };
}

const ТРИ = [
  row("1", "Иван Петров", "new", null),
  row("2", "Мария Соколова", "in_progress", "anton"),
  row("3", "Пётр Иванов", "new", "irina"),
];

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
  });
  window.localStorage.clear();
  mocks.push.mockReset();
  mocks.triageLead.mockReset().mockResolvedValue({});
  mocks.leads.mockReset().mockImplementation((filter: Record<string, string>, page = 0, size = 50) =>
    // Счётчики чипов просят одну строку. Отдавать им весь список значит
    // не заметить, что экран запросил страницу вместо числа.
    Promise.resolve(
      size === 1
        ? { items: [], page: 0, size: 1, total: 7, pages: 7 }
        : {
            items: ТРИ.map(full),
            page,
            size: 50,
            total: 3,
            pages: 1,
            // Фильтр возвращается назад, чтобы проверка видела, с чем звали.
            asked: filter,
          },
    ),
  );
});

async function экран() {
  const user = userEvent.setup();
  render(
    <ToastHost>
      <WhoHost who={{ actor: "irina", roles: ["portal-admin"], authentication: "keycloak" }}>
        <CountsHost>
          <LeadsPage />
        </CountsHost>
      </WhoHost>
    </ToastHost>,
  );
  await screen.findByText("Иван Петров");
  return user;
}

/** С каким отбором звали список (запросы счётчиков не в счёт). */
function последнийОтбор(): Record<string, string> {
  const списки = mocks.leads.mock.calls.filter((c) => c[2] !== 1);
  return (списки.at(-1)?.[0] ?? {}) as Record<string, string>;
}

describe("отбор заявок", () => {
  it("поиск уходит в портал, а не отбирает загруженное", async () => {
    const user = await экран();

    await user.type(screen.getByLabelText("Поиск по заявкам"), "Соколова");

    await vi.waitFor(() => expect(последнийОтбор().query).toBe("Соколова"));
  });

  it("на каждую букву запроса не шлёт", async () => {
    const user = await экран();
    const было = mocks.leads.mock.calls.filter((c) => c[2] !== 1).length;

    await user.type(screen.getByLabelText("Поиск по заявкам"), "Соколова");
    await vi.waitFor(() => expect(последнийОтбор().query).toBe("Соколова"));

    const стало = mocks.leads.mock.calls.filter((c) => c[2] !== 1).length;
    // Восемь букв — один запрос сверх исходного, а не восемь.
    expect(стало - было).toBeLessThanOrEqual(2);
  });

  it("«Без ответственного» — это вопрос порталу, а не пустая строка", async () => {
    const user = await экран();

    await user.click(screen.getByRole("button", { name: /Без ответственного/ }));

    expect(последнийОтбор().owner).toBe("-");
  });

  it("«Мои в работе» подставляет вошедшего, а не имя из разметки", async () => {
    const user = await экран();

    await user.click(screen.getByRole("button", { name: /Мои в работе/ }));

    expect(последнийОтбор()).toMatchObject({ owner: "irina", status: "in_progress" });
  });
});

describe("массовые действия", () => {
  it("смена статуса сохраняет ответственного каждой заявки", async () => {
    const user = await экран();

    await user.click(screen.getByLabelText(/Выбрать заявку: Мария Соколова/));
    await user.click(screen.getByLabelText(/Выбрать заявку: Пётр Иванов/));
    await user.click(screen.getByRole("button", { name: "Сменить статус" }));
    await user.click(screen.getByRole("radio", { name: "выиграна" }));

    await vi.waitFor(() => expect(mocks.triageLead).toHaveBeenCalledTimes(2));
    // У каждой заявки свой ответственный, и общее значение подставить некуда:
    // так массовое действие снесло бы то, чего не трогали.
    expect(mocks.triageLead).toHaveBeenCalledWith("2", "won", "anton");
    expect(mocks.triageLead).toHaveBeenCalledWith("3", "won", "irina");
  });

  it("назначение ответственного сохраняет статус каждой заявки", async () => {
    const user = await экран();

    await user.click(screen.getByLabelText(/Выбрать заявку: Иван Петров/));
    await user.click(screen.getByLabelText(/Выбрать заявку: Мария Соколова/));
    await user.click(screen.getByRole("button", { name: "Назначить ответственного" }));

    const поп = screen.getByRole("combobox", { name: /Ответственный/ });
    await user.selectOptions(поп, "anton");
    await user.click(screen.getByRole("button", { name: "Назначить" }));

    await vi.waitFor(() => expect(mocks.triageLead).toHaveBeenCalledTimes(2));
    expect(mocks.triageLead).toHaveBeenCalledWith("1", "new", "anton");
    expect(mocks.triageLead).toHaveBeenCalledWith("2", "in_progress", "anton");
  });

  it("отмена возвращает каждой заявке её прежние значения", async () => {
    const user = await экран();

    await user.click(screen.getByLabelText(/Выбрать заявку: Мария Соколова/));
    await user.click(screen.getByLabelText(/Выбрать заявку: Пётр Иванов/));
    await user.click(screen.getByRole("button", { name: "Сменить статус" }));
    await user.click(screen.getByRole("radio", { name: "проиграна" }));

    await vi.waitFor(() => expect(mocks.triageLead).toHaveBeenCalledTimes(2));
    mocks.triageLead.mockClear();

    await user.click(await screen.findByRole("button", { name: "Отменить" }));

    // Не «вернуть как было у первой» — у каждой было своё.
    await vi.waitFor(() => expect(mocks.triageLead).toHaveBeenCalledTimes(2));
    expect(mocks.triageLead).toHaveBeenCalledWith("2", "in_progress", "anton");
    expect(mocks.triageLead).toHaveBeenCalledWith("3", "new", "irina");
  });

  it("частичный отказ называет число, а не выдаёт себя за успех", async () => {
    const user = await экран();
    mocks.triageLead
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("портал отказал"));

    await user.click(screen.getByLabelText(/Выбрать заявку: Мария Соколова/));
    await user.click(screen.getByLabelText(/Выбрать заявку: Пётр Иванов/));
    await user.click(screen.getByRole("button", { name: "Сменить статус" }));
    await user.click(screen.getByRole("radio", { name: "выиграна" }));

    expect(await screen.findByText(/Не удалось изменить 1 из 2/)).toBeTruthy();
  });
});

describe("выделение", () => {
  it("SHIFT+КЛИК берёт всё между строками, а не одну", async () => {
    const user = await экран();

    await user.click(screen.getByLabelText(/Выбрать заявку: Иван Петров/));

    // Модификатор у userEvent зажимается отдельно: параметр `{ shiftKey }`
    // у click он не читает, и щелчок ушёл бы обычным — то есть открыл бы
    // разбор вместо выделения диапазона.
    await user.keyboard("{Shift>}");
    await user.click(screen.getByText("Пётр Иванов"));
    await user.keyboard("{/Shift}");

    expect(screen.getByText(/Выбрано 3 заявки/)).toBeTruthy();
    // И разбор при этом не открылся: SHIFT+КЛИК — про выделение.
    expect(screen.queryByRole("dialog", { name: "Разбор заявки" })).toBeNull();
  });

  it("флажок шапки выделяет всё, повторное нажатие снимает", async () => {
    const user = await экран();

    const шапка = screen.getByLabelText("Выбрать всё: заявки") as HTMLInputElement;
    await user.click(шапка);
    expect(screen.getByText(/Выбрано 3 заявки/)).toBeTruthy();

    await user.click(screen.getByLabelText("Снять выделение: заявки"));
    expect(screen.queryByText(/Выбрано/)).toBeNull();
  });

  it("при половине выделенных флажок шапки в промежуточном состоянии", async () => {
    const user = await экран();

    await user.click(screen.getByLabelText(/Выбрать заявку: Иван Петров/));

    // Атрибута разметки у промежуточного состояния нет — только свойство.
    // Без него флажок при половине выделенных выглядит снятым, и нажатие
    // «выбрать всё» читается как «снять всё».
    const шапка = screen.getByLabelText("Выбрать всё: заявки") as HTMLInputElement;
    expect(шапка.indeterminate).toBe(true);
    expect(шапка.checked).toBe(false);
  });
});

describe("колонки", () => {
  it("выключенная колонка уходит из таблицы, а не прячется", async () => {
    const user = await экран();
    expect(screen.getByText("+7 343 555-22-12")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Колонки" }));
    await user.click(screen.getByRole("checkbox", { name: "Контакты" }));

    expect(screen.queryByText("+7 343 555-22-12")).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Контакты" })).toBeNull();
  });
});

describe("клавиши списка", () => {
  it("J и K ведут курсор, ПРОБЕЛ выделяет", async () => {
    const user = await экран();

    await user.keyboard("j");
    await user.keyboard(" ");

    // Курсор стоит на первой строке, J уводит на вторую.
    expect(screen.getByText(/Выбрано 1 заявка/)).toBeTruthy();
    expect(
      (screen.getByLabelText(/Выбрать заявку: Мария Соколова/) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("в поле поиска J остаётся буквой", async () => {
    const user = await экран();

    await user.click(screen.getByLabelText("Поиск по заявкам"));
    await user.keyboard("j");

    expect((screen.getByLabelText("Поиск по заявкам") as HTMLInputElement).value).toBe("j");
    expect(screen.queryByText(/Выбрано/)).toBeNull();
  });
});

describe("что видно в строке", () => {
  it("заявка без ответственного помечена словом, а не пустотой", async () => {
    await экран();

    const строка = screen.getByText("Иван Петров").closest("tr")!;
    expect(within(строка).getByText("не назначен")).toBeTruthy();
  });

  it("под таблицей — сколько показано из скольких", async () => {
    await экран();

    expect(screen.getByText("Показаны 1–3 из 3")).toBeTruthy();
  });
});
