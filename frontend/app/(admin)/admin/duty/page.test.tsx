import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

// Дежурство: график и плашка «дежурит сегодня».
//
// Проверяется то, ради чего это заводилось, и ровно в тех местах, где оно
// ломается молча.
//
// 1. Пустой день — это ответ, а не пустота. «Никто не назначен» и «портал
//    не отвечает» — разные утверждения, и экран обязан их различать.
// 2. Дежурство и присутствие показываются рядом и не заменяют друг друга.
//    Имя без присутствия читается как «она отвечает» при закрытой вкладке;
//    присутствие без имени не отвечает на вопрос, с кого спрашивать.
// 3. Расхождение между ними считает портал (`alarm`), а не экран. Собери
//    экран это сам — правило разошлось бы с тем, по которому когда-нибудь
//    будет уходить письмо.
// 4. Выбор человека — из справочника. Логин руками ошибается молча:
//    смена оказывается на человеке, которого нет, а по ней решают,
//    кому звонить.

const mocks = vi.hoisted(() => ({
  duty: vi.fn(),
  dutyToday: vi.fn(),
  assignDuty: vi.fn(),
  releaseDuty: vi.fn(),
  handOffDuty: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  AdminError: class AdminError extends Error {},
  duty: mocks.duty,
  dutyToday: mocks.dutyToday,
  assignDuty: mocks.assignDuty,
  releaseDuty: mocks.releaseDuty,
  handOffDuty: mocks.handOffDuty,
  staff: () =>
    Promise.resolve([
      { login: "i.koltsova", name: "Ирина Кольцова", enabled: true, roles: ["portal-sales"] },
      { login: "a.rogov", name: "Антон Рогов", enabled: true, roles: ["portal-sales"] },
      // Отключённый в справочнике остаётся — на нём старые сделки, — но
      // дежурить не может: портал откажет, и предлагать его значит соврать.
      { login: "uvolen", name: "Пётр Уволенный", enabled: false, roles: [] },
    ]),
}));

import DutyPage from "./page";
import Duty from "../Duty";

/** Сегодня в том же виде, в каком его считает экран: `YYYY-MM-DD`. */
function сегодня(): string {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

const ПУСТО = {
  date: сегодня(),
  login: null,
  name: null,
  note: null,
  atDesk: false,
  staffOnline: false,
  workingHours: true,
  alarm: false,
  supportHours: "Пн–Пт 9:00–17:30 (Екатеринбург)",
};

beforeEach(() => {
  mocks.duty.mockReset().mockResolvedValue([]);
  mocks.dutyToday.mockReset().mockResolvedValue(ПУСТО);
  mocks.assignDuty.mockReset().mockResolvedValue({});
  mocks.releaseDuty.mockReset().mockResolvedValue(undefined);
  mocks.handOffDuty.mockReset().mockResolvedValue({});
});

// ————— плашка —————

it("говорит «никто не назначен», а не показывает пустоту", async () => {
  render(<Duty />);

  expect(await screen.findByText("никто не назначен")).toBeInTheDocument();
  expect(screen.getByText(/передавать смену некому/)).toBeInTheDocument();
  // Передавать нечего — кнопки нет: она привела бы к отказу портала.
  expect(screen.queryByRole("button", { name: "Передать смену" })).not.toBeInTheDocument();
});

it("показывает имя дежурного и присутствие рядом, а не вместо", async () => {
  mocks.dutyToday.mockResolvedValue({
    ...ПУСТО,
    login: "i.koltsova",
    name: "Ирина Кольцова",
    atDesk: true,
    staffOnline: true,
  });

  render(<Duty />);

  expect(await screen.findByText("Ирина Кольцова")).toBeInTheDocument();
  expect(screen.getByText("на месте")).toBeInTheDocument();
});

it("расхождение с присутствием берётся у портала, а не собирается на экране", async () => {
  mocks.dutyToday.mockResolvedValue({
    ...ПУСТО,
    login: "i.koltsova",
    name: "Ирина Кольцова",
    atDesk: false,
    staffOnline: true,
    workingHours: true,
    alarm: true,
  });

  render(<Duty />);

  expect(await screen.findByText("рабочее место не открыто")).toBeInTheDocument();
  expect(screen.getByText(/рабочее время идёт/)).toBeInTheDocument();
});

it("не поднимает тревогу, когда портал её не поднял", async () => {
  // Те же «места нет» и «время рабочее», но alarm=false: решение принимает
  // портал. Экран, который считает сам, разошёлся бы с ним молча.
  mocks.dutyToday.mockResolvedValue({
    ...ПУСТО,
    login: "i.koltsova",
    name: "Ирина Кольцова",
    atDesk: false,
    workingHours: true,
    alarm: false,
  });

  render(<Duty />);

  expect(await screen.findByText("рабочее место не открыто")).toBeInTheDocument();
  expect(screen.queryByText(/рабочее время идёт/)).not.toBeInTheDocument();
});

it("передаёт смену выбранному из справочника, а не введённому руками", async () => {
  mocks.dutyToday.mockResolvedValue({
    ...ПУСТО,
    login: "i.koltsova",
    name: "Ирина Кольцова",
    atDesk: true,
    staffOnline: true,
  });

  render(<Duty />);
  await userEvent.click(await screen.findByRole("button", { name: "Передать смену" }));

  const выбор = await screen.findByRole("combobox");
  // Себя в списке нет: портал откажет передать смену самому себе.
  expect(within(выбор).queryByText("Ирина Кольцова")).not.toBeInTheDocument();
  // Отключённого нет: он смену не примет.
  expect(within(выбор).queryByText("Пётр Уволенный")).not.toBeInTheDocument();

  await userEvent.selectOptions(выбор, "a.rogov");
  await userEvent.click(screen.getByRole("button", { name: "Передать" }));

  await waitFor(() => expect(mocks.handOffDuty).toHaveBeenCalledWith("a.rogov", undefined));
});

// ————— график —————

it("рисует две недели целиком, включая дни без дежурного", async () => {
  render(<DutyPage />);

  await screen.findByRole("heading", { name: "Дежурство" });
  // Четыре колонки шапки плюс четырнадцать строк-заголовков дня.
  const строки = await screen.findAllByRole("row");
  expect(строки).toHaveLength(15);
  expect(screen.getByText("сегодня")).toBeInTheDocument();
});

it("назначение уходит в портал днём и логином", async () => {
  render(<DutyPage />);

  const выборы = await screen.findAllByRole("combobox");
  await userEvent.selectOptions(выборы[0], "a.rogov");

  await waitFor(() =>
    expect(mocks.assignDuty).toHaveBeenCalledWith(сегодня(), "a.rogov"),
  );
});

it("«никто» снимает дежурного, а не записывает пустой логин", async () => {
  mocks.duty.mockResolvedValue([
    {
      date: сегодня(),
      login: "a.rogov",
      name: "Антон Рогов",
      note: null,
      assignedBy: "boss",
      assignedAt: "2026-09-08T06:00:00Z",
      atDesk: false,
    },
  ]);

  render(<DutyPage />);

  const выборы = await screen.findAllByRole("combobox");
  await userEvent.selectOptions(выборы[0], "");

  await waitFor(() => expect(mocks.releaseDuty).toHaveBeenCalledWith(сегодня()));
  expect(mocks.assignDuty).not.toHaveBeenCalled();
});

it("отказ портала показывается словами, а не молча теряется", async () => {
  mocks.assignDuty.mockRejectedValue(new Error("Прошедший день не правится"));

  render(<DutyPage />);

  const выборы = await screen.findAllByRole("combobox");
  await userEvent.selectOptions(выборы[0], "a.rogov");

  expect(await screen.findByText(/Прошедший день не правится/)).toBeInTheDocument();
});
