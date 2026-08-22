import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Что видит в админке каждая роль.
//
// Правило доступа живёт на портале, и обойти его нельзя. Здесь оно решает
// другую задачу: не показывать кнопку, которая приведёт к отказу. Показать
// её — соврать дважды, сначала предложив, потом отказав.
//
// Проверяется обе стороны: что раздел ПОКАЗАН тому, кому положен, и что он
// НЕ показан остальным. Половина проверки зеленеет от снятого фильтра.

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  pathname: "/admin/",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  // Оболочка уводит по горячим клавишам в разделы; сам переход проверяется
  // в shell.test.tsx, здесь нужен только рабочий крючок.
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  authConfigured: true,
  accessToken: async () => "токен",
  login: vi.fn(),
  logout: vi.fn(),
  // Подписка на выход в соседней вкладке. Без неё оболочка не поднимается.
  onSessionLost: () => () => {},
}));

// Счётчики вкладок ходят в восемь дверей сразу. Здесь они не проверяются,
// но подставить их надо: без них оболочка зовёт настоящий портал.
vi.mock("@/lib/admin", () => {
  // Объявления внутри фабрики, а не над ней: vi.mock уезжает наверх файла.
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

class Observer {
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", Observer);
  mocks.pathname = "/admin/";
});

/** Оболочка под заданными ролями. */
async function оболочка(roles: string[], pathname = "/admin/") {
  mocks.pathname = pathname;
  mocks.session.mockResolvedValue({ actor: "кто-то", roles, authentication: "keycloak" });
  render(
    <AdminLayout>
      <div className="admin-head">
        <h1>Страница</h1>
      </div>
    </AdminLayout>,
  );
  await screen.findByRole("navigation", { name: "Разделы админки" });
}

function разделы(): string[] {
  const полоса = screen.getByRole("navigation", { name: "Разделы админки" });
  return [...полоса.querySelectorAll("a")].map((a) => a.textContent?.trim() ?? "");
}

describe("разделы по ролям", () => {
  it("продажи не видят содержимого сайта", async () => {
    await оболочка(["portal-sales"]);

    expect(разделы()).toContain("Работа с клиентами");
    expect(разделы()).not.toContain("Содержимое сайта");
    // Журнал показывает, кто что делал, включая того, кто смотрит.
    expect(разделы()).not.toContain("Журнал");
  });

  it("тот, кто ведёт сайт, не видит клиентской базы", async () => {
    await оболочка(["portal-production"]);

    // Это главное правило всей раскладки: клиентская база и суммы сделок
    // отнесены брифом собственника к тому, что наружу не выносим,
    // а «наружу» начинается с лишнего человека внутри.
    expect(разделы()).toContain("Содержимое сайта");
    expect(разделы()).not.toContain("Работа с клиентами");
    expect(разделы()).not.toContain("Журнал");
  });

  it("администратор видит всё", async () => {
    await оболочка(["portal-admin"]);

    for (const раздел of ["Сводка", "Содержимое сайта", "Работа с клиентами", "Команда", "Журнал"]) {
      expect(разделы()).toContain(раздел);
    }
  });

  it("«Команда» остаётся у всех, но справочник сотрудников — административный", async () => {
    await оболочка(["portal-sales"], "/admin/profile/");

    expect(разделы()).toContain("Команда");

    // Внутри раздела вкладки отбираются отдельно: свой профиль нужен каждому,
    // состав компании — нет.
    const вкладки = screen.queryByRole("navigation", { name: "Команда" });
    const подписи = вкладки ? [...вкладки.querySelectorAll("a")].map((a) => a.textContent) : [];
    expect(подписи.join(" ")).not.toContain("Сотрудники");
  });
});

describe("страница чужого контура", () => {
  it("объясняет отказ, а не показывает пустой экран", async () => {
    // Адрес набирают руками и присылают ссылкой: спрятанный в шапке раздел
    // этого не закрывает. Без проверки человек увидел бы страницу с полосой
    // ошибки от портала вместо объяснения.
    await оболочка(["portal-production"], "/admin/leads/");

    expect(screen.getByRole("heading", { name: "Раздел закрыт" })).toBeTruthy();
    expect(screen.getByText(/работе с клиентами/)).toBeTruthy();
    // И это не «войдите заново»: вход выполнен, токен тот же.
    expect(screen.getByText(/повторный вход ничего не изменит/)).toBeTruthy();
    // Самой страницы на экране нет.
    expect(screen.queryByRole("heading", { name: "Страница" })).toBeNull();
  });

  it("свой контур открывается как обычно", async () => {
    await оболочка(["portal-production"], "/admin/products/");

    expect(screen.getByRole("heading", { name: "Страница" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Раздел закрыт" })).toBeNull();
  });

  it("сводка открыта всем: запирает портал, а не этот файл", async () => {
    // Неизвестный интерфейсу адрес не должен запираться на всякий случай —
    // забытый здесь раздел выглядел бы поломкой ровно у того, кто прав.
    await оболочка(["portal-sales"], "/admin/");
    expect(screen.getByRole("heading", { name: "Страница" })).toBeTruthy();

    const свой = within(screen.getByRole("navigation", { name: "Разделы админки" }));
    expect(свой.getByText("Сводка")).toBeTruthy();
  });
});
