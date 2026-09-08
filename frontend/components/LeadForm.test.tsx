import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Серийный номер изделия в сервисном обращении.
//
// Проверяется здесь не то, что поле нарисовано, а два решения, которые
// ломаются тихо.
//
// Первое: поле спрашивается только в сервисном обращении. В форме запроса
// цены или каталога изделия у человека ещё нет, и вопрос про его серийный
// номер — либо шум, либо повод бросить форму.
//
// Второе: снятое поле не должно ничего отправлять. Человек может выбрать
// «Сервисное обращение», вписать номер, передумать и выбрать «Запрос КП» —
// и номер от прошлого выбора не имеет права уехать вместе с заявкой,
// которая уже не про сервис.
//
// Проверка идёт по тому, что уходит в submitLead, а не по разметке: поле
// можно спрятать стилями и всё равно отправить его значение.

const mocks = vi.hoisted(() => ({
  submitLead: vi.fn(),
  newIdempotencyKey: vi.fn(() => "ключ-1"),
}));

vi.mock("@/lib/submit", () => ({
  submitLead: mocks.submitLead,
  newIdempotencyKey: mocks.newIdempotencyKey,
  attribution: () => ({ language: "ru", campaign: undefined }),
}));

import LeadForm, { type Topic } from "./LeadForm";

const ТЕМЫ: readonly Topic[] = [
  { code: "quote", label: "Запрос коммерческого предложения" },
  { code: "service", label: "Сервисное обращение" },
];

/** Форма сервиса: тема задана страницей, селектора тем нет. */
async function сервиснаяФорма() {
  const user = userEvent.setup();
  await act(async () => {
    render(<LeadForm form="service" analytics="service_form_submit" />);
  });
  return user;
}

/** Форма контактов: тему выбирает человек. */
async function формаСТемами() {
  const user = userEvent.setup();
  await act(async () => {
    render(<LeadForm form="quote" topics={ТЕМЫ} analytics="quote_form_submit" />);
  });
  return user;
}

/** Всё, кроме серийного номера: он необязателен, и это часть проверки. */
async function заполнитьОбязательное(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Контактное лицо/), "Ольга Кузнецова");
  await user.type(screen.getByLabelText(/Телефон/), "+7 343 200 10 10");
  await user.type(screen.getByLabelText(/Электронная почта/), "olga@rd2.ru");
  await user.type(
    screen.getByLabelText(/Суть обращения/),
    "Аппарат не выходит на режим после включения.",
  );
  await user.click(screen.getByRole("checkbox"));
}

const отправить = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: /Отправить/ }));

const серийныйНомер = () => screen.queryByLabelText(/Серийный номер/);

beforeEach(() => {
  mocks.submitLead.mockReset().mockResolvedValue({ ok: true, message: "Заявка принята" });
});

describe("серийный номер спрашивается там, где изделие уже есть", () => {
  it("сервисная форма о нём спрашивает", async () => {
    await сервиснаяФорма();

    expect(серийныйНомер()).toBeInTheDocument();
  });

  it("форма запроса цены — нет", async () => {
    await act(async () => {
      render(<LeadForm form="quote" analytics="quote_form_submit" />);
    });

    expect(серийныйНомер()).not.toBeInTheDocument();
  });

  it("поле появляется при выборе сервисной темы и уходит при смене", async () => {
    const user = await формаСТемами();

    expect(серийныйНомер(), "тема по умолчанию — запрос КП").not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Тема обращения"), "service");
    expect(серийныйНомер()).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Тема обращения"), "quote");
    expect(серийныйНомер()).not.toBeInTheDocument();
  });
});

describe("что уезжает с заявкой", () => {
  it("номер уходит вместе с обращением", async () => {
    const user = await сервиснаяФорма();
    await заполнитьОбязательное(user);

    await user.type(серийныйНомер()!, "R2-2026-00417");
    await отправить(user);

    expect(mocks.submitLead.mock.calls[0][0]).toMatchObject({
      form: "service",
      serialNumber: "R2-2026-00417",
    });
  });

  it("пустое поле не уезжает пустой строкой", async () => {
    const user = await сервиснаяФорма();
    await заполнитьОбязательное(user);

    await отправить(user);

    // undefined, а не "": бэкенд отличает «номер не указан» от «номер есть,
    // но пустой», и заявки со вторым состоянием загрязняют поиск по номеру.
    expect(mocks.submitLead.mock.calls[0][0].serialNumber).toBeUndefined();
  });

  it("номер, набранный до смены темы, с чужой заявкой не уезжает", async () => {
    const user = await формаСТемами();

    await user.selectOptions(screen.getByLabelText("Тема обращения"), "service");
    await user.type(серийныйНомер()!, "R2-2026-00417");
    await user.selectOptions(screen.getByLabelText("Тема обращения"), "quote");

    await заполнитьОбязательное(user);
    await отправить(user);

    expect(mocks.submitLead.mock.calls[0][0]).toMatchObject({ form: "quote" });
    expect(mocks.submitLead.mock.calls[0][0].serialNumber).toBeUndefined();
  });
});

// Единственная проверка номера — длина, и та же стоит на бэкенде. Формат
// не проверяется намеренно: вид номера VEDAL в согласованных материалах
// не описан, а маска отклоняла бы настоящие номера.
describe("длина номера", () => {
  it("слишком длинный номер не отправляется и объясняет почему", async () => {
    const user = await сервиснаяФорма();
    await заполнитьОбязательное(user);

    await user.click(серийныйНомер()!);
    await user.paste("1".repeat(101));
    await отправить(user);

    expect(mocks.submitLead).not.toHaveBeenCalled();
    expect(screen.getByText("Серийный номер не длиннее 100 символов")).toBeInTheDocument();
  });

  it("номер ровно в сто символов принимается", async () => {
    const user = await сервиснаяФорма();
    await заполнитьОбязательное(user);

    await user.click(серийныйНомер()!);
    await user.paste("1".repeat(100));
    await отправить(user);

    expect(mocks.submitLead).toHaveBeenCalledTimes(1);
  });
});

// Список полей формы — один на две задачи: по нему ищется первое поле
// с ошибкой и по нему же отбираются ошибки бэкенда. Раньше это были два
// независимых литерала, и добавление поля требовало вспомнить про оба.
//
// Промах фокуса замечает только тот, кто ходит по форме с клавиатуры или
// со скринридером, — то есть об ошибке никто не сообщит. Поэтому проверка
// здесь, а не в ручном обходе.
describe("фокус встаёт на первую ошибку сверху", () => {
  it("на серийный номер, когда остальное заполнено", async () => {
    const user = await сервиснаяФорма();
    await заполнитьОбязательное(user);

    await user.click(серийныйНомер()!);
    await user.paste("1".repeat(101));
    await отправить(user);

    expect(document.activeElement).toBe(серийныйНомер());
  });

  it("на контактное лицо, когда пусто всё", async () => {
    const user = await сервиснаяФорма();

    await отправить(user);

    expect(mocks.submitLead).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText(/Контактное лицо/));
  });

  // Серийный номер стоит в списке между почтой и текстом обращения. Если
  // порядок разъедется с разметкой, человек попадёт не на верхнюю ошибку,
  // а на случайную — и форма будет выглядеть исправной.
  it("на почту, а не на номер, когда сломано и то и другое", async () => {
    const user = await сервиснаяФорма();
    await заполнитьОбязательное(user);

    await user.clear(screen.getByLabelText(/Электронная почта/));
    await user.click(серийныйНомер()!);
    await user.paste("1".repeat(101));
    await отправить(user);

    expect(document.activeElement).toBe(screen.getByLabelText(/Электронная почта/));
  });
});

describe("подсказка под полем", () => {
  it("связана с полем, пока ошибки нет", async () => {
    await сервиснаяФорма();

    const поле = серийныйНомер()!;
    const описание = поле.getAttribute("aria-describedby");
    expect(описание).toBeTruthy();
    expect(document.getElementById(описание!)?.textContent).toBe(
      "Если знаете — ускорит разбор обращения",
    );
  });
});

// Запрос КП с карточки изделия (issue про кнопку-пустышку).
//
// Проверяется не то, что название нарисовано, а два решения, которые
// ломаются тихо и одинаково незаметно.
//
// Первое: изделие не спрашивается второй раз. Человек уже выбрал его тем,
// что дошёл до карточки; селектор рядом — это выбор, который можно сделать
// неправильно, и заявка уедет не про то изделие, которое человек читал.
//
// Второе: слаг всё равно уезжает. Форма без селектора выглядит исправной
// и тогда, когда `productSlug` не отправляется вовсе, — а без него менеджер
// в админке видит заявку «по чему-то», и весь смысл кнопки на карточке
// пропадает. Проверка идёт по телу, ушедшему в submitLead, а не по разметке.
const ИЗДЕЛИЕ = { slug: "vedal-a-2000", name: "VEDAL A-2000", kind: "Аппарат ИВЛ" };

async function формаКарточки() {
  const user = userEvent.setup();
  await act(async () => {
    render(
      <LeadForm
        form="quote"
        product={ИЗДЕЛИЕ}
        analytics="quote_form_submit"
        submitLabel="Запросить КП"
      />,
    );
  });
  return user;
}

const запросить = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Запросить КП" }));

describe("изделие, заданное страницей", () => {
  it("названо, но не спрашивается", async () => {
    await формаКарточки();

    expect(screen.getByText(/VEDAL A-2000/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Изделие")).not.toBeInTheDocument();
  });

  it("уезжает с заявкой слагом", async () => {
    const user = await формаКарточки();
    await заполнитьОбязательное(user);

    await запросить(user);

    expect(mocks.submitLead.mock.calls[0][0]).toMatchObject({
      form: "quote",
      productSlug: "vedal-a-2000",
    });
  });

  // Список каталога и заданное изделие вместе не встречаются: на карточке
  // выбирать нечего. Перекрытие проверяется здесь, потому что иначе рядом
  // с названием изделия однажды окажется селектор всего каталога — и не
  // будет видно, что именно уедет.
  it("перекрывает список каталога", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(
        <LeadForm
          form="quote"
          product={ИЗДЕЛИЕ}
          products={[ИЗДЕЛИЕ, { slug: "vedal-r1", name: "VEDAL R1", kind: "Аппарат ИВЛ" }]}
          analytics="quote_form_submit"
          submitLabel="Запросить КП"
        />,
      );
    });

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    await заполнитьОбязательное(user);
    await запросить(user);

    expect(mocks.submitLead.mock.calls[0][0].productSlug).toBe("vedal-a-2000");
  });

  // Согласие обязательно и здесь — §14.6 плана. Форма на карточке ничем
  // не отличается от формы на /contacts/ в том, что касается персональных
  // данных, и «быстрый запрос» не является причиной его не спрашивать.
  it("без согласия ничего не отправляет", async () => {
    const user = await формаКарточки();

    await user.type(screen.getByLabelText(/Контактное лицо/), "Ольга Кузнецова");
    await user.type(screen.getByLabelText(/Телефон/), "+7 343 200 10 10");
    await user.type(screen.getByLabelText(/Электронная почта/), "olga@rd2.ru");
    await user.type(
      screen.getByLabelText(/Суть обращения/),
      "Нужна конфигурация для отделения реанимации новорождённых.",
    );
    await запросить(user);

    expect(mocks.submitLead).not.toHaveBeenCalled();
    expect(screen.getByText("Без согласия отправить запрос нельзя")).toBeInTheDocument();
  });
});

// Форма без изделия и без списка каталога — та, что стоит в сервисном
// обращении. Поле изделия там не должно появляться вовсе: пустая подпись
// «Изделие» без значения читается как потерянные данные.
describe("формы без изделия", () => {
  it("поля изделия не рисуют", async () => {
    await сервиснаяФорма();

    expect(screen.queryByText("Изделие")).not.toBeInTheDocument();
  });
});
