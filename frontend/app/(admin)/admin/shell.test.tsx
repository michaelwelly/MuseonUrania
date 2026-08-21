import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Общие механизмы оболочки: поиск по всему, горячие клавиши, счётчики вкладок,
// полоса-сообщение с отменой, колокол и виджет разговоров.
//
// Проверяется здесь ровно то, что нельзя увидеть глазами и что ломается молча.
//
// Главное из этого — клавиши. Одиночная буква как команда живёт на волоске:
// стоит забыть проверку фокуса, и «Новосибирск», набранный в поле города,
// уводит человека в новую сделку на букве N, а «где» в примечании к КП —
// в список сделок на аккорде G+D. Ошибка не даёт ни отказа, ни сообщения:
// страница просто меняется под руками, а набранное пропадает.
//
// Второе — счётчики. Число рядом с именем вкладки читается как утверждение
// портала. Счётчик, оставшийся от прошлой загрузки или подставленный вместо
// отказавшего запроса, врёт молча и убедительно.

const mocks = vi.hoisted(() => ({
  pathname: "/admin/",
  session: vi.fn(),
  push: vi.fn(),
  clients: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/auth", () => ({
  authConfigured: true,
  accessToken: async () => "token",
  login: vi.fn(),
  logout: vi.fn(),
  onSessionLost: () => () => {},
}));

vi.mock("@/lib/admin", () => {
  const страница = (total: number) => () =>
    Promise.resolve({ items: [], page: 0, size: 1, total, pages: 1 });

  return {
    adminConfigured: true,
    session: mocks.session,
    AdminError: class AdminError extends Error {},
    // Числа разные у каждой двери: одинаковые не отличили бы «счётчик взял
    // своё» от «счётчик взял чужое».
    products: () => Promise.resolve([{ id: "p1", slug: "vedal-r1", name: "VEDAL R1" }]),
    news: () => Promise.resolve([]),
    documents: () => Promise.resolve([{ id: "d1" }, { id: "d2" }, { id: "d3" }]),
    chatQueue: страница(3),
    chatThread: () => Promise.resolve({ id: null, status: "closed", messages: [] }),
    leads: страница(12),
    clients: mocks.clients,
    deals: страница(19),
    quotes: страница(8),
  };
});

import AdminLayout from "./layout";
import { ToastHost, useToast } from "./Toast";
import { initials } from "./Avatar";

class Observer {
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", Observer);
  mocks.pathname = "/admin/";
  mocks.push.mockReset();
  mocks.session.mockReset().mockResolvedValue({
    actor: "Ирина Кольцова",
    roles: ["portal-editor"],
  });
  mocks.clients
    .mockReset()
    .mockResolvedValue({ items: [], page: 0, size: 1, total: 112, pages: 1 });
});

/** Оболочка с полем ввода внутри: без него нечем проверить фокус. */
async function shell(pathname = "/admin/") {
  mocks.pathname = pathname;
  const user = userEvent.setup();
  render(
    <AdminLayout>
      <div className="admin-head">
        <h1>Страница</h1>
      </div>
      <input aria-label="Город" />
    </AdminLayout>,
  );
  await screen.findByText("Ирина Кольцова");
  return user;
}

describe("клавиши оболочки", () => {
  it("⌘K открывает поиск, ESC закрывает", async () => {
    const user = await shell();

    expect(screen.queryByRole("dialog", { name: "Поиск по всему порталу" })).toBeNull();

    await user.keyboard("{Meta>}k{/Meta}");
    expect(screen.getByRole("dialog", { name: "Поиск по всему порталу" })).toBeTruthy();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Поиск по всему порталу" })).toBeNull();
  });

  it("⌘K работает и когда человек стоит в поле", async () => {
    const user = await shell();
    await user.click(screen.getByLabelText("Город"));

    await user.keyboard("{Meta>}k{/Meta}");

    // Сочетание с модификатором не набирается ни в одном поле, и прятать
    // его от полей незачем: иначе поиск недоступен ровно там, где человек
    // чаще всего сидит.
    expect(screen.getByRole("dialog", { name: "Поиск по всему порталу" })).toBeTruthy();
  });

  // Строка нарочно латинская и нарочно из командных букв: адрес на сайте,
  // slug изделия и логин набираются именно так. Кириллица эту проверку
  // не делает — на ней физические клавиши другие, и тест прошёл бы даже
  // со снятой защитой.
  it("одиночная буква в поле остаётся буквой", async () => {
    const user = await shell();
    const поле = screen.getByLabelText("Город") as HTMLInputElement;
    await user.click(поле);

    await user.keyboard("grand-nd");

    expect(поле.value).toBe("grand-nd");
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("аккорд G в поле не уводит со страницы", async () => {
    const user = await shell();
    await user.click(screen.getByLabelText("Город"));

    await user.keyboard("gd");

    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("N вне поля заводит сделку, G затем D ведёт в сделки", async () => {
    const user = await shell();

    await user.keyboard("n");
    expect(mocks.push).toHaveBeenCalledWith("/admin/deals/new");

    mocks.push.mockReset();
    await user.keyboard("gd");
    expect(mocks.push).toHaveBeenCalledWith("/admin/deals/");
  });

  // Админка русская, и раскладку под сочетание никто не переключает.
  // На русской раскладке `key` у этих клавиш — «л», «т», «в»: пока клавиша
  // искалась по `key`, не работало ни одно сочетание, и увидеть это можно
  // было только замером — отказа нет, просто ничего не происходит.
  it("работает на русской раскладке, где key — не латинская буква", async () => {
    await shell();

    fireEvent.keyDown(document, { key: "л", code: "KeyK", metaKey: true });
    expect(screen.getByRole("dialog", { name: "Поиск по всему порталу" })).toBeTruthy();

    // Дождаться закрытия обязательно, а не желательно: пока окно открыто,
    // одиночные буквы намеренно молчат. Без ожидания тест иногда успевал
    // нажать N раньше, чем оболочка узнала, что окна больше нет, —
    // и падал через раз, обвиняя раскладку.
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Поиск по всему порталу" })).toBeNull(),
    );

    fireEvent.keyDown(document, { key: "т", code: "KeyN" });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin/deals/new"));

    mocks.push.mockReset();
    fireEvent.keyDown(document, { key: "п", code: "KeyG" });
    fireEvent.keyDown(document, { key: "в", code: "KeyD" });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin/deals/"));
  });

  it("G сама по себе никуда не ведёт", async () => {
    const user = await shell();

    await user.keyboard("g");
    await user.keyboard("x");

    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("«?» открывает горячие клавиши, а в поле печатается", async () => {
    const user = await shell();

    await user.keyboard("?");
    expect(screen.getByRole("dialog", { name: "Горячие клавиши" })).toBeTruthy();
    await user.keyboard("{Escape}");

    const поле = screen.getByLabelText("Город") as HTMLInputElement;
    await user.click(поле);
    await user.keyboard("?");
    expect(поле.value).toBe("?");
  });

  it("пока открыто окно, одиночные буквы молчат", async () => {
    const user = await shell();

    await user.keyboard("?");
    await user.keyboard("n");

    // Иначе N под открытым окном уводит на новую сделку, а окно остаётся
    // висеть поверх страницы, которую человек не открывал.
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe("счётчики вкладок", () => {
  it("показывает число из портала, включая ноль", async () => {
    await shell("/admin/products/");

    const вкладки = await screen.findByRole("navigation", { name: "Содержимое сайта" });
    const текст = вкладки.textContent ?? "";

    // innerText склеил бы соседние узлы, поэтому проверяется подпись целиком:
    // она собирается из имени и числа в одном месте и врозь не разъедется.
    expect(await screen.findByLabelText("Продукция, 1")).toBeTruthy();
    expect(await screen.findByLabelText("Новости, 0")).toBeTruthy();
    expect(await screen.findByLabelText("Документы, 3")).toBeTruthy();
    expect(текст).toContain("Категории");
  });

  it("у вкладки без счётчика числа нет вовсе", async () => {
    await shell("/admin/analytics/");

    const аналитика = await screen.findByRole("link", { name: "Аналитика" });
    // Ноль здесь означал бы «аналитики ноль», а её не считают штуками.
    expect(аналитика.querySelector(".admin-tab__count")).toBeNull();
  });

  it("отказавшая дверь оставляет вкладку без числа, а не с нулём", async () => {
    mocks.clients.mockRejectedValue(new Error("портал отказал"));
    await shell("/admin/clients/");

    const клиенты = await screen.findByRole("link", { name: "Клиенты" });
    expect(клиенты.querySelector(".admin-tab__count")).toBeNull();
    // Соседи при этом на месте: отказ одного счётчика не роняет остальные.
    expect(await screen.findByLabelText("Сделки, 19")).toBeTruthy();
  });
});

describe("поиск по всему", () => {
  it("находит клиента и уводит в его карточку", async () => {
    mocks.clients.mockResolvedValue({
      items: [{ id: "c7", name: "Кольцова и партнёры", inn: "7701234567", city: "Казань" }],
      page: 0,
      size: 6,
      total: 1,
      pages: 1,
    });

    const user = await shell();
    await user.keyboard("{Meta>}k{/Meta}");
    await user.type(screen.getByLabelText("Что искать"), "Коль");

    const строка = await screen.findByText("Кольцова и партнёры");
    await user.click(строка);

    expect(mocks.push).toHaveBeenCalledWith("/admin/clients/c7");
  });

  it("до двух букв в портал не ходит", async () => {
    const user = await shell();
    await user.keyboard("{Meta>}k{/Meta}");

    mocks.clients.mockClear();
    await user.type(screen.getByLabelText("Что искать"), "К");

    // Одна буква — это половина запросов ко всей базе клиентов на каждое
    // открытие окна, и ни одного полезного ответа.
    expect(mocks.clients).not.toHaveBeenCalled();
  });
});

describe("колокол", () => {
  it("говорит, что ленты нет, вместо правдоподобных строк", async () => {
    const user = await shell();

    await user.click(screen.getByRole("button", { name: "Уведомления" }));

    expect(screen.getByText("Ожидает уточнения")).toBeTruthy();
    // Счётчика на колоколе быть не должно: цифра — тоже утверждение.
    expect(screen.getByRole("button", { name: "Уведомления" }).textContent).toBe("");
  });
});

describe("виджет разговоров", () => {
  it("показывает, сколько ждёт ответа", async () => {
    await shell();

    const кнопка = await screen.findByRole("button", { name: /Разговоры/ });
    expect(кнопка.textContent).toContain("3");
  });

  it("на самом разделе разговоров не рисуется", async () => {
    await shell("/admin/chats/");

    expect(screen.queryByRole("button", { name: /Разговоры/ })).toBeNull();
  });
});

describe("полоса-сообщение", () => {
  function Probe() {
    const toast = useToast();
    return (
      <button onClick={() => toast("Изделие снято с публикации", отмена)}>снять</button>
    );
  }
  const отмена = vi.fn();

  it("показывает сообщение и вызывает отмену", async () => {
    отмена.mockReset();
    const user = userEvent.setup();
    render(
      <ToastHost>
        <Probe />
      </ToastHost>,
    );

    await user.click(screen.getByRole("button", { name: "снять" }));
    expect(screen.getByText("Изделие снято с публикации")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Отменить" }));
    expect(отмена).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Изделие снято с публикации")).toBeNull();
  });

  it("отказ отмены показывает причину, а не кнопку по второму кругу", async () => {
    отмена.mockReset().mockRejectedValue(new Error("портал отказал: 409"));
    const user = userEvent.setup();
    render(
      <ToastHost>
        <Probe />
      </ToastHost>,
    );

    await user.click(screen.getByRole("button", { name: "снять" }));
    await user.click(screen.getByRole("button", { name: "Отменить" }));

    expect(await screen.findByText("портал отказал: 409")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Отменить" })).toBeNull();
  });
});

describe("инициалы", () => {
  it("берёт по букве из первых двух слов", () => {
    expect(initials("Ирина Кольцова")).toBe("ИК");
  });

  it("разбирает логин по точкам и приводит регистр", () => {
    expect(initials("i.koltsova")).toBe("IK");
  });

  it("из одного слова берёт одну букву, а не две первых", () => {
    // «Ир» читается как обрезанное имя, «И» — как инициал.
    expect(initials("editor")).toBe("E");
  });

  it("не падает на учётной записи без букв", () => {
    expect(initials("—")).toBe("?");
  });
});
