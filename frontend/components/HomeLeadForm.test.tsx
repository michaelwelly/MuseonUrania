import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Согласие на обработку персональных данных. §14.6 плана: без галочки форма
// не отправляется.
//
// Проверяется здесь не удобство, а то, что нельзя чинить задним числом.
// До 18 августа форма отправляла `consent: true` всегда, а под кнопкой стояла
// подпись «нажимая кнопку, вы соглашаетесь» — человек выбора не делал, но
// бэкенд сохранял согласие так, будто делал. Отказ тихий: форма работает,
// заявка приходит, и заметить это можно только читая код.
//
// Поэтому проверка идёт по тому, что уходит в submitLead, а не по тому, что
// нарисовано на экране: сообщение об ошибке можно вернуть и всё равно
// отправить данные.

const mocks = vi.hoisted(() => ({
  submitLead: vi.fn(),
  newIdempotencyKey: vi.fn(() => "ключ-1"),
}));

vi.mock("@/lib/submit", () => ({
  submitLead: mocks.submitLead,
  newIdempotencyKey: mocks.newIdempotencyKey,
}));

import HomeLeadForm from "./HomeLeadForm";

async function заполнить() {
  const user = userEvent.setup();
  await act(async () => {
    render(<HomeLeadForm />);
  });

  await user.type(screen.getByLabelText("Имя"), "Егор");
  await user.type(screen.getByLabelText("Телефон"), "+7 343 555 22 11");
  await user.type(screen.getByLabelText("Рабочая почта"), "egor@example.ru");
  await user.type(
    screen.getByLabelText("Сообщение"),
    "Нужен инкубатор для отделения новорождённых",
  );

  return user;
}

const отправить = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: /Отправить запрос/ }));

beforeEach(() => {
  mocks.submitLead.mockReset().mockResolvedValue({ ok: true, message: "Заявка принята" });
});

describe("согласие на обработку персональных данных", () => {
  it("не отправляет заявку, пока галочка не стоит", async () => {
    const user = await заполнить();

    await отправить(user);

    expect(mocks.submitLead).not.toHaveBeenCalled();
    expect(screen.getByText("Без согласия отправить запрос нельзя")).toBeInTheDocument();
  });

  it("отправляет заявку, когда галочка стоит", async () => {
    const user = await заполнить();

    await user.click(screen.getByRole("checkbox"));
    await отправить(user);

    expect(mocks.submitLead).toHaveBeenCalledTimes(1);
    expect(mocks.submitLead.mock.calls[0][0]).toMatchObject({
      name: "Егор",
      email: "egor@example.ru",
      consent: true,
    });
  });

  // Остальные поля пустые, галочка стоит: заявка всё равно не должна уйти.
  // Иначе согласие превратилось бы в единственную проверку формы.
  it("не отправляет заявку с одной галочкой и пустыми полями", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<HomeLeadForm />);
    });

    await user.click(screen.getByRole("checkbox"));
    await отправить(user);

    expect(mocks.submitLead).not.toHaveBeenCalled();
  });

  it("ведёт на политику обработки прямо из строки согласия", async () => {
    await act(async () => {
      render(<HomeLeadForm />);
    });

    // Слеш на конце добавляет trailingSlash из next.config, а он в тестовой
    // среде не подключён: в браузере адрес «/legal/privacy/», здесь без слеша.
    // Проверяем маршрут, а не то, как его нормализовал Link.
    expect(screen.getByRole("link", { name: /Политика обработки/ }).getAttribute("href")).toMatch(
      /^\/legal\/privacy\/?$/,
    );
  });
});
