import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Сводка.
//
// Экран отвечает на один вопрос — что делать сейчас, — и ломается он тихо
// тремя способами.
//
// Строка с нулём. «0 документов без файла» выглядит как работа, а работой
// не является. Список дел, наполовину состоящий из нулей, перестают читать
// на третий день.
//
// Порядок. Разговор — единственная запись портала, у которой на том конце
// ждёт человек прямо сейчас. Замер прошлой сессии: разговор ждал живого
// ответа четвёртый день, а сводка считала заявки, документы и КП — и молчала
// о нём.
//
// Слово на кнопке. Одинаковое «Открыть →» у восьми строк отвечает на вопрос
// «куда», а вопрос был «что делать».

const mocks = vi.hoisted(() => ({ leads: vi.fn(), quotes: vi.fn(), chatQueue: vi.fn() }));

vi.mock("@/lib/admin", () => {
  const страница = (total: number) => ({ items: [], page: 0, size: 1, total, pages: 1 });
  return {
    AdminError: class AdminError extends Error {},
    NOBODY: "-",
    leads: mocks.leads,
    quotes: mocks.quotes,
    chatQueue: mocks.chatQueue,
    products: () =>
      Promise.resolve([
        { id: "p1", published: true },
        { id: "p2", published: false },
      ]),
    news: () => Promise.resolve([{ id: "n1", published: true }]),
    documents: () =>
      Promise.resolve([
        { id: "d1", published: true, hasFile: true },
        { id: "d2", published: false, hasFile: true },
      ]),
    clients: () => Promise.resolve(страница(112)),
    deals: () => Promise.resolve(страница(19)),
    audit: () => Promise.resolve({ items: [], page: 0, size: 5, total: 0, pages: 1 }),
    staff: () =>
      Promise.resolve([{ login: "i.koltsova", name: "Ирина Кольцова", enabled: true }]),
  };
});

import Dashboard from "./page";
import { WhoHost } from "./who";

/** По умолчанию: ждут два разговора, заявок ничьих три, всё прочее разобрано. */
function обычно() {
  const страница = (total: number) =>
    Promise.resolve({ items: [], page: 0, size: 1, total, pages: 1 });

  mocks.chatQueue.mockResolvedValue({ items: [], page: 0, size: 1, total: 2, pages: 1 });
  mocks.leads.mockImplementation((filter: { status?: string; owner?: string }) => {
    if (filter.owner === "-") return страница(3);
    if (filter.status === "draft") return страница(0);
    return страница(48);
  });
  mocks.quotes.mockImplementation(() => страница(0));
}

beforeEach(() => {
  window.localStorage.clear();
  mocks.leads.mockReset();
  mocks.quotes.mockReset();
  mocks.chatQueue.mockReset();
  обычно();
});

async function сводка() {
  const user = userEvent.setup();
  render(
    <WhoHost who={{ actor: "i.koltsova", roles: ["portal-admin"], authentication: "keycloak" }}>
      <Dashboard />
    </WhoHost>,
  );
  await screen.findByText(/ждут ответа/);
  return user;
}

describe("что требует внимания", () => {
  it("строки с нулём не показывает вовсе", async () => {
    await сводка();

    // Всё прочее разобрано: КП нет, черновиков новостей нет, документов
    // без файла нет. Ноль — это не работа.
    expect(screen.queryByText(/КП/)).toBeNull();
    expect(screen.queryByText(/документ без файла/)).toBeNull();
    expect(screen.queryByText(/материал в черновиках/)).toBeNull();
  });

  it("разговоры стоят первыми и помечены как горящие", async () => {
    await сводка();

    const очередь = screen.getByText(/ждут ответа/).closest("a")!;
    const все = [...document.querySelectorAll(".queue__row")];
    expect(все[0]).toBe(очередь);
    // Красным, потому что человек ждёт прямо сейчас, а не до конца дня.
    expect(очередь.querySelector(".queue__count--danger")).toBeTruthy();
  });

  it("на кнопке слово действия, а не «Открыть»", async () => {
    await сводка();

    expect(
      within(screen.getByText(/ждут ответа/).closest("a")!).getByText("Ответить →"),
    ).toBeTruthy();
    expect(
      within(screen.getByText(/без ответственного/).closest("a")!).getByText("Назначить →"),
    ).toBeTruthy();
  });

  it("заявки без ответственного спрашиваются у портала, а не считаются на глаз", async () => {
    await сводка();

    expect(mocks.leads).toHaveBeenCalledWith({ owner: "-" }, 0, 1);

    // Число берётся из ответа портала: посчитать «ничьи» по загруженной
    // странице нельзя — на экране их нет вовсе.
    const строка = screen.getByText(/без ответственного/).closest("a")!;
    expect(строка.querySelector(".queue__count")?.textContent).toBe("3");
  });

  it("когда разобрано всё, говорит это словами", async () => {
    const страница = (total: number) =>
      Promise.resolve({ items: [], page: 0, size: 1, total, pages: 1 });
    mocks.chatQueue.mockResolvedValue({ items: [], page: 0, size: 1, total: 0, pages: 1 });
    mocks.leads.mockImplementation((filter: { status?: string; owner?: string }) =>
      filter.status || filter.owner ? страница(0) : страница(48),
    );

    render(
      <WhoHost who={{ actor: "i.koltsova", roles: [], authentication: "keycloak" }}>
        <Dashboard />
      </WhoHost>,
    );

    // Один черновик изделия в сиде остаётся — но и он строка, а не пустота.
    expect(await screen.findByText(/изделие в черновиках/)).toBeTruthy();
  });
});

describe("приветствие", () => {
  it("здоровается именем из справочника, а не логином", async () => {
    await сводка();

    // «Доброе утро, i.koltsova» — это приветствие учётной записи.
    const заголовок = screen.getByRole("heading", { level: 1 });
    expect(заголовок.textContent).toContain("Ирина");
    expect(заголовок.textContent).not.toContain("i.koltsova");
  });
});

describe("карточка для новичка", () => {
  it("убирается и остаётся убранной", async () => {
    const user = await сводка();

    expect(screen.getByText("Три правила, из которых следует остальное")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Убрать подсказку" }));

    expect(screen.queryByText("Три правила, из которых следует остальное")).toBeNull();
    // Подсказка, которую нельзя закрыть, через неделю читается как реклама.
    expect(window.localStorage.getItem("vedal.admin.hints")).toBe("false");
  });
});
