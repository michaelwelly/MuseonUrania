import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Выбор ответственного. Проверяется одно, но самое опасное: переход
// со свободной строки на список не должен стирать то, что уже записано.
//
// Логин уволенного или та самая опечатка, ради которой список и заводился,
// в справочнике отсутствуют. Если форма молча подставит вместо них пустоту,
// первое же открытие карточки — и сохранение — снимет ответственного,
// ничего не спросив. Ошибка тихая: отказа нет, поле выглядит нормально.

const mocks = vi.hoisted(() => ({
  AdminError: class AdminError extends Error {},
  staff: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  AdminError: mocks.AdminError,
  staff: mocks.staff,
}));

import OwnerField from "./OwnerField";

const ЛЮДИ = [
  { login: "fedorova", name: "Анна Фёдорова", enabled: true },
  { login: "uvolen", name: "Пётр Уволенный", enabled: false },
];

async function show(value: string) {
  await act(async () => {
    render(<OwnerField value={value} onChange={() => {}} />);
  });
}

beforeEach(() => {
  mocks.staff.mockReset().mockResolvedValue(ЛЮДИ);
});

describe("выбор ответственного", () => {
  it("показывает имя, а логин остаётся значением", async () => {
    await show("fedorova");

    const select = screen.getByLabelText(/Ответственный/) as HTMLSelectElement;
    expect(select.value).toBe("fedorova");
    expect(screen.getByRole("option", { name: "Анна Фёдорова" })).toBeInTheDocument();
  });

  it("не теряет логин, которого нет в справочнике", async () => {
    await show("ushel.v.proshlom");

    const select = screen.getByLabelText(/Ответственный/) as HTMLSelectElement;
    // Значение осталось прежним, и человек видит, что оно выбрано, —
    // а не «не назначен», как если бы его подменили пустотой.
    expect(select.value).toBe("ushel.v.proshlom");
    expect(
      screen.getByRole("option", { name: /ushel\.v\.proshlom.*нет в справочнике/ }),
    ).toBeInTheDocument();
  });

  it("отключённого показывает и помечает", async () => {
    await show("uvolen");

    expect(screen.getByRole("option", { name: /Пётр Уволенный.*отключён/ })).toBeInTheDocument();
  });

  it("пусто — это «не назначен», а не пропуск", async () => {
    await show("");

    const select = screen.getByLabelText(/Ответственный/) as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(screen.getByRole("option", { name: "— не назначен" })).toBeInTheDocument();
  });

  // Справочник недоступен — поле обязано остаться рабочим: сохранить
  // карточку с прежним ответственным важнее, чем показать список.
  it("при недоступном справочнике не теряет значение", async () => {
    mocks.staff.mockRejectedValue(new Error("Портал не отвечает."));
    await show("fedorova");

    const select = screen.getByLabelText(/Ответственный/) as HTMLSelectElement;
    expect(select.value).toBe("fedorova");
  });
});
