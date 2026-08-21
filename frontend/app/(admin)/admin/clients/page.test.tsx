import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Список клиентов и просмотр без ухода со списка.
//
// Поиск идёт по всей базе, а не по загруженной странице, и запрос на каждую
// нажатую букву — это девять запросов на слово «перинатальный» и восемь
// заведомо ненужных ответов, каждый из которых тащит персональные данные.
//
// Боковая панель заведена, чтобы не уходить со списка ради вопроса «кто это
// и сколько с ним сделок». Отсюда две вещи, которые ломаются молча: панель
// должна относиться к строке, которая есть на экране, а щелчок по «правке»
// не должен одновременно открывать панель и уводить в карточку.

const mocks = vi.hoisted(() => ({
  AdminError: class AdminError extends Error {},
  clients: vi.fn(),
  client: vi.fn(),
  deals: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  AdminError: mocks.AdminError,
  clients: mocks.clients,
  client: mocks.client,
  deals: mocks.deals,
}));

import ClientsPage from "./page";

const ROW = {
  id: "client-1",
  name: "Областной перинатальный центр",
  kind: "company",
  inn: "5406826069",
  city: "Екатеринбург",
  owner: "editor",
  deals: 2,
  updatedAt: "2026-08-12T09:00:00Z",
};

const БЕЗ_ИНН = {
  ...ROW,
  id: "client-2",
  name: "Иванов Иван Иванович",
  kind: "person",
  inn: null,
  owner: null,
  deals: 0,
};

const КАРТОЧКА = {
  id: "client-1",
  version: 3,
  name: "Областной перинатальный центр",
  kind: "company",
  inn: "5406826069",
  kpp: "540601001",
  externalId: null,
  country: "Россия",
  city: "Екатеринбург",
  email: "opc@example.ru",
  phone: "+7 343 555-10-10",
  note: null,
  owner: "editor",
  createdAt: "2026-07-01T09:00:00Z",
  updatedAt: "2026-08-12T09:00:00Z",
};

function page(items: unknown[]) {
  return { items, page: 0, size: 50, total: items.length, pages: 1 };
}

beforeEach(() => {
  mocks.clients.mockReset().mockResolvedValue(page([ROW, БЕЗ_ИНН]));
  mocks.client.mockReset().mockResolvedValue(КАРТОЧКА);
  mocks.deals.mockReset().mockResolvedValue(
    page([
      {
        id: "deal-1",
        clientId: "client-1",
        clientName: "Областной перинатальный центр",
        pipeline: "sales",
        title: "Две системы R2",
        stage: "quoted",
        amount: 2650000,
        currency: "RUB",
        productSlug: "vedal-r2",
        owner: "editor",
        createdAt: "2026-08-01T09:00:00Z",
        updatedAt: "2026-08-10T09:00:00Z",
      },
    ]),
  );
});

async function экран() {
  const user = userEvent.setup();
  render(<ClientsPage />);
  await screen.findByText("Областной перинатальный центр");
  return user;
}

describe("поиск", () => {
  it("не ходит в портал на каждую букву", async () => {
    const user = await экран();
    expect(mocks.clients).toHaveBeenCalledTimes(1);

    await user.type(screen.getByLabelText("Поиск по клиентской базе"), "перинат");

    // Семь букв — один запрос сверх исходного, а не семь. Каждый лишний
    // тащит персональные данные, которых никто не просил.
    await waitFor(() => expect(mocks.clients.mock.calls.at(-1)?.[0]).toBe("перинат"));
    expect(mocks.clients.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("очищенное поле возвращает всю базу, а не пустой список", async () => {
    const user = await экран();
    const поле = screen.getByLabelText("Поиск по клиентской базе");

    await user.type(поле, "нет такого");
    await waitFor(() => expect(mocks.clients.mock.calls.at(-1)?.[0]).toBe("нет такого"));

    await user.clear(поле);
    await waitFor(() => expect(mocks.clients.mock.calls.at(-1)?.[0]).toBe(""));
  });
});

describe("просмотр без ухода со списка", () => {
  it("щелчок по строке открывает карточку рядом, а не вместо списка", async () => {
    const user = await экран();

    await user.click(screen.getByText("Областной перинатальный центр"));

    expect(await screen.findByText("Просмотр без ухода со списка")).toBeTruthy();
    // Список на месте: в этом весь смысл панели.
    expect(screen.getByText("Иванов Иван Иванович")).toBeTruthy();
  });

  it("сделки клиента спрашиваются отдельно — в строке только число", async () => {
    const user = await экран();

    await user.click(screen.getByText("Областной перинатальный центр"));

    await waitFor(() => expect(mocks.deals).toHaveBeenCalledWith({ clientId: "client-1" }, 0, 10));
    expect(await screen.findByText("Две системы R2")).toBeTruthy();
    expect(screen.getByText("2 650 000,00 RUB")).toBeTruthy();
  });

  it("«правка» уводит в карточку и не открывает заодно панель", async () => {
    const user = await экран();

    const строка = screen.getByText("Областной перинатальный центр").closest("tr")!;
    await user.click(within(строка).getByRole("link", { name: /Правка карточки/ }));

    // Иначе щелчок делает два дела разом: уводит на другую страницу
    // и открывает панель на той, с которой уходит.
    expect(screen.queryByText("Просмотр без ухода со списка")).toBeNull();
  });

  it("после смены выборки панель не показывает того, кого нет в списке", async () => {
    const user = await экран();
    await user.click(screen.getByText("Областной перинатальный центр"));
    expect(await screen.findByText("Просмотр без ухода со списка")).toBeTruthy();

    mocks.clients.mockResolvedValue(page([БЕЗ_ИНН]));
    await user.type(screen.getByLabelText("Поиск по клиентской базе"), "Иванов");

    await waitFor(() =>
      expect(screen.queryByText("Просмотр без ухода со списка")).toBeNull(),
    );
  });
});

describe("что видно в строке", () => {
  it("клиент без ИНН и без ответственного — прочерк и слово, а не пустота", async () => {
    await экран();

    const строка = screen.getByText("Иванов Иван Иванович").closest("tr")!;
    // Отсутствие ИНН у частного лица — это факт, и видеть его надо.
    expect(within(строка).getByText("—")).toBeTruthy();
    expect(within(строка).getByText("не назначен")).toBeTruthy();
  });
});
