import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Поиск по клиентской базе идёт по всей базе. Запрос на каждую нажатую букву
// — это девять запросов на слово «перинатальный» и восемь заведомо ненужных
// ответов, каждый из которых тащит персональные данные.

const mocks = vi.hoisted(() => ({
  AdminError: class AdminError extends Error {},
  clients: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  AdminError: mocks.AdminError,
  clients: mocks.clients,
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

function page(items: unknown[]) {
  return { items, page: 0, size: 50, total: items.length, pages: 1 };
}

beforeEach(() => {
  mocks.clients.mockReset().mockResolvedValue(page([ROW]));
});

describe("список клиентов", () => {
  it("не ходит в портал на каждую букву", async () => {
    const user = userEvent.setup();
    render(<ClientsPage />);

    await screen.findByText("Областной перинатальный центр");
    expect(mocks.clients).toHaveBeenCalledTimes(1);

    await user.type(screen.getByPlaceholderText("Наименование или ИНН"), "перинат");
    expect(mocks.clients).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Найти" }));
    await waitFor(() => expect(mocks.clients).toHaveBeenCalledTimes(2));
    expect(mocks.clients.mock.calls[1][0]).toBe("перинат");
  });

  it("ищет по Enter, не заставляя целиться в кнопку", async () => {
    const user = userEvent.setup();
    render(<ClientsPage />);

    await screen.findByText("Областной перинатальный центр");
    await user.type(screen.getByPlaceholderText("Наименование или ИНН"), "5406826069{Enter}");

    await waitFor(() => expect(mocks.clients).toHaveBeenCalledTimes(2));
    expect(mocks.clients.mock.calls[1][0]).toBe("5406826069");
  });

  it("сброс возвращает всю базу, а не пустой список", async () => {
    const user = userEvent.setup();
    render(<ClientsPage />);

    await screen.findByText("Областной перинатальный центр");
    await user.type(screen.getByPlaceholderText("Наименование или ИНН"), "нет такого{Enter}");
    await waitFor(() => expect(mocks.clients).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole("button", { name: "Сбросить" }));
    await waitFor(() => expect(mocks.clients).toHaveBeenCalledTimes(3));
    expect(mocks.clients.mock.calls[2][0]).toBe("");
  });
});
