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
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
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

vi.mock("@/lib/admin", () => ({
  adminConfigured: true,
  session: mocks.session,
  AdminError: class AdminError extends Error {},
}));

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

/** Пункт, помеченный как текущий, в названной полосе. */
function currentIn(label: string): string[] {
  const strip = screen.getByRole("navigation", { name: label });
  return [...strip.querySelectorAll('[aria-current="page"]')].map((n) => n.textContent ?? "");
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
