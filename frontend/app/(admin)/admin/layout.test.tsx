import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Навигация оболочки: какой раздел и какая вкладка считаются текущими.
//
// Проверяется не вёрстка, а разбор адреса — он ломается молча и уже ломался.
// Адрес сводки `/admin/` — префикс всех остальных, и наивная проверка
// «начинается с» подсвечивает её на каждой странице. Обратная ошибка не
// дешевле: карточка сделки живёт по адресу `/admin/deals/42`, и сравнение
// на равенство гасит вкладку «Сделки» ровно там, где человек в ней работает.

const mocks = vi.hoisted(() => ({
  pathname: "/admin/",
  session: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  // Оболочка слушает клавиши и уводит по ним в разделы; сам переход
  // проверяется в shell.test.tsx, здесь нужен только рабочий крючок.
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/auth", () => ({
  authConfigured: true,
  accessToken: async () => "token",
  login: vi.fn(),
  logout: vi.fn(),
  // Подписка на выход в соседней вкладке. Здесь она не проверяется —
  // её поведение лежит в lib/auth.test.ts, — но без неё оболочка
  // не поднимается вовсе.
  onSessionLost: () => () => {},
}));

// Счётчики вкладок ходят в восемь дверей сразу. Здесь они не проверяются
// (это shell.test.tsx), но подставить их надо: без них оболочка зовёт
// undefined и падает раньше первой проверки навигации.
vi.mock("@/lib/admin", () => {
  // Объявления внутри фабрики, а не над ней: vi.mock уезжает наверх файла,
  // и внешняя переменная к этому моменту ещё не создана.
  const пусто = () => Promise.resolve([]);
  const страница = () => Promise.resolve({ items: [], page: 0, size: 1, total: 0, pages: 0 });

  return {
    adminConfigured: true,
    session: mocks.session,
    AdminError: class AdminError extends Error {},
    products: пусто,
    news: пусто,
    documents: пусто,
    chatQueue: страница,
    chatThread: () => Promise.resolve({ id: null, status: "closed", messages: [] }),
    leads: страница,
    clients: страница,
    deals: страница,
    quotes: страница,
  };
});

import AdminLayout from "./layout";

// jsdom не знает ResizeObserver, а на нём стоит замер высоты липкой полосы.
class Observer {
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", Observer);
  mocks.session.mockReset().mockResolvedValue({ actor: "editor", roles: ["portal-editor"] });
});

/** Оболочка на заданном адресе — уже после того, как портал принял токен. */
async function shell(pathname: string) {
  mocks.pathname = pathname;
  render(
    <AdminLayout>
      <div className="admin-head">
        <h1>Страница</h1>
      </div>
    </AdminLayout>,
  );
  await screen.findByText("editor");
}

/**
 * Пункт, помеченный как текущий, в названной полосе.
 *
 * Счётчик из подписи вычитается. textContent склеивает соседние узлы,
 * и вкладка «КП» со счётчиком ноль читается как «КП0» — тот же приём,
 * которым замер уже однажды солгал про «11заявок».
 */
function currentIn(label: string): string[] {
  const strip = screen.getByRole("navigation", { name: label });
  return [...strip.querySelectorAll('[aria-current="page"]')].map((n) => {
    const count = n.querySelector(".admin-tab__count")?.textContent ?? "";
    const text = n.textContent ?? "";
    return count ? text.slice(0, text.length - count.length) : text;
  });
}

describe("навигация админки", () => {
  it("на сводке подсвечивает сводку, а не всё сразу", async () => {
    await shell("/admin/");

    expect(currentIn("Разделы админки")).toEqual(["Сводка"]);
    // У сводки нет вкладок, и пустой полосы под шапкой быть не должно.
    expect(screen.queryByRole("navigation", { name: "Работа с клиентами" })).toBeNull();
  });

  it("на карточке сделки держит и раздел, и вкладку", async () => {
    await shell("/admin/deals/42");

    expect(currentIn("Разделы админки")).toEqual(["Работа с клиентами"]);
    expect(currentIn("Работа с клиентами")).toEqual(["Сделки"]);
  });

  it("не подсвечивает сводку на вложенных страницах", async () => {
    await shell("/admin/products/new");

    expect(currentIn("Разделы админки")).toEqual(["Содержимое сайта"]);
    expect(currentIn("Содержимое сайта")).toEqual(["Продукция"]);
  });

  it("разделу из одного пункта полосу вкладок не рисует", async () => {
    await shell("/admin/audit/");

    expect(currentIn("Разделы админки")).toEqual(["Журнал"]);
    expect(screen.queryByRole("navigation", { name: "Журнал" })).toBeNull();
  });

  it("называет в крошках раздел и страницу", async () => {
    await shell("/admin/quotes/7");

    const crumbs = document.querySelector(".admin-crumbs");
    expect(crumbs?.textContent).toContain("Работа с клиентами");
    expect(crumbs?.textContent).toContain("КП");
  });

  // Обратная сторона того же правила.
  //
  // На списке раздел подсвечен в шапке, вкладка подсвечена и помечена
  // aria-current, заголовок страницы называет её же — крошки говорили то же
  // самое четвёртый раз. Замер на экране заявок: 41 пиксель на каждом списке,
  // а до первой строки данных уходило 469 из 900.
  it("на списке крошек нет — навигация уже сказала, где мы", async () => {
    await shell("/admin/quotes/");

    expect(document.querySelector(".admin-crumbs")).toBeNull();
    // Но «где я» никуда не делось: вкладка помечена, заголовок на месте.
    expect(currentIn("Работа с клиентами")).toEqual(["КП"]);
  });

  it("до входа показывает вход, а не рабочее место", async () => {
    mocks.pathname = "/admin/";
    mocks.session.mockRejectedValue(new Error("нет роли portal-editor"));
    render(
      <AdminLayout>
        <div>содержимое</div>
      </AdminLayout>,
    );

    await screen.findByText("нет роли portal-editor");
    expect(screen.queryByRole("navigation", { name: "Разделы админки" })).toBeNull();
    expect(screen.queryByText("содержимое")).toBeNull();
  });
});
