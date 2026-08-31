import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Виджет Ведалины.
//
// Тестов у него не было вовсе, и именно здесь замер на живом стенде нашёл
// самое дорогое: кнопка «Специалист VEDAL» никого не звала. Она отправляла
// свою подпись как обычный вопрос, поиск отвечал на неё списком изделий,
// разговор оставался у машины. Нажатие срабатывало, запрос уходил, ответ
// приходил — неправильным был смысл, а не механика, и увидеть это можно
// было только нажав.
//
// Поэтому проверяется не то, что нарисовано, а КУДА уходит нажатие.

const mocks = vi.hoisted(() => ({
  sayInChat: vi.fn(),
  callHuman: vi.fn(),
  chatPrompts: vi.fn(),
  chatThread: vi.fn(),
  pingTyping: vi.fn(),
  visitorKey: vi.fn(() => "ключ-вкладки"),
  // Тип объявлен явно: без него подделка выводится как «всегда null»,
  // и тесты потока не могут подставить адрес.
  chatStreamUrl: vi.fn((): string | null => null),
}));

vi.mock("@/lib/submit", () => ({
  apiConfigured: true,
  sayInChat: mocks.sayInChat,
  callHuman: mocks.callHuman,
  chatPrompts: mocks.chatPrompts,
  chatThread: mocks.chatThread,
  pingTyping: mocks.pingTyping,
  visitorKey: mocks.visitorKey,
  chatStreamUrl: mocks.chatStreamUrl,
}));

import VedalinaChat from "./VedalinaChat";

const КНОПКИ = [
  { intent: "equipment", label: "Подобрать оборудование", action: "ask" },
  { intent: "quote", label: "Запросить КП", action: "ask" },
  { intent: "human", label: "Позвать специалиста", action: "handoff" },
];

function лента(messages: unknown[], status = "open", answering = false) {
  return { id: "разговор-1", status, messages, answering };
}

function реплика(author: string, body: string, extra: Record<string, unknown> = {}) {
  return {
    author,
    actor: null,
    body,
    sources: [],
    at: "2026-08-21T09:30:00Z",
    readAt: null,
    ...extra,
  };
}

beforeEach(() => {
  mocks.chatPrompts.mockReset().mockResolvedValue(КНОПКИ);
  mocks.chatThread.mockReset().mockResolvedValue(null);
  // Дверь принимает вопрос и отвечает СРАЗУ, ещё без ответа Ведалины:
  // ответ доезжает потоком. Подделка обязана вести себя так же, иначе тесты
  // проверяют пайплайн, которого больше нет.
  mocks.sayInChat.mockReset().mockResolvedValue(принято("вопрос"));
  mocks.callHuman.mockReset().mockResolvedValue(
    лента([реплика("assistant", "Зову специалиста VEDAL. Разговор встал в очередь.")], "waiting"),
  );
  mocks.pingTyping.mockReset();
});

/** Вопрос принят, Ведалина взялась считать — то, что возвращает дверь. */
function принято(вопрос: string) {
  return лента([реплика("visitor", вопрос)], "open", true);
}

/** Разговор с готовым ответом — то, что приходит лентой следом. */
function lentaПосле(ответ: string) {
  return лента([реплика("visitor", "вопрос"), реплика("assistant", ответ)]);
}

/**
 * Поддельный поток событий.
 *
 * На уровне файла, а не внутри одного describe: потоком приходит теперь
 * не только «в разговоре новое», но и раздумье Ведалины с кусками ответа,
 * и проверяют это разные блоки.
 */
class ПоддельныйПоток {
  static последний: ПоддельныйПоток | null = null;
  слушатели = new Map<string, ((e: MessageEvent) => void)[]>();
  onmessage: ((e: MessageEvent) => void) | null = null;
  constructor() {
    ПоддельныйПоток.последний = this;
  }
  addEventListener(вид: string, fn: (e: MessageEvent) => void) {
    this.слушатели.set(вид, [...(this.слушатели.get(вид) ?? []), fn]);
  }
  close() {}
  послать(вид: string, data = '"c1"') {
    const event = { data } as MessageEvent;
    if (вид === "message") this.onmessage?.(event);
    for (const fn of this.слушатели.get(вид) ?? []) fn(event);
  }
}

function подключитьПоток() {
  mocks.chatStreamUrl.mockReturnValue("http://portal/stream");
  (globalThis as unknown as { EventSource: unknown }).EventSource = ПоддельныйПоток;
}

async function открыть() {
  const user = userEvent.setup();
  await act(async () => {
    render(<VedalinaChat />);
  });
  return user;
}

describe("кнопки", () => {
  it("берутся с портала, а не из содержимого", async () => {
    await открыть();

    // Подпись и заготовка, разложенные по двум местам, расходятся на первой
    // же правке — и расходятся молча: ответ просто перестаёт находиться.
    await screen.findByRole("button", { name: "Подобрать оборудование" });
    expect(screen.getByRole("button", { name: "Позвать специалиста" })).toBeTruthy();
    expect(mocks.chatPrompts).toHaveBeenCalled();
  });

  it("вопрос уходит вместе с намерением, а не одной подписью", async () => {
    const user = await открыть();
    await screen.findByRole("button", { name: "Запросить КП" });

    await user.click(screen.getByRole("button", { name: "Запросить КП" }));

    // Намерение — то, что нажали. Портал по нему выбирает заготовку;
    // по совпадению подписи он выбирать не должен, иначе правка текста
    // кнопки отправит вопрос в поиск.
    await waitFor(() =>
      expect(mocks.sayInChat).toHaveBeenCalledWith("ключ-вкладки", "Запросить КП", "quote"),
    );
  });

  it("«Позвать специалиста» зовёт специалиста, а не отправляет свою подпись", async () => {
    const user = await открыть();
    await screen.findByRole("button", { name: "Позвать специалиста" });

    await user.click(screen.getByRole("button", { name: "Позвать специалиста" }));

    // Вот это и было сломано: подпись уходила вопросом, поиск отвечал
    // каталогом, разговор оставался открытым — человека никто не звал.
    await waitFor(() => expect(mocks.callHuman).toHaveBeenCalledWith("ключ-вкладки"));
    expect(mocks.sayInChat).not.toHaveBeenCalled();
  });
});

describe("ожидание человека", () => {
  it("появляется сразу после того, как позвали", async () => {
    const user = await открыть();
    await screen.findByRole("button", { name: "Позвать специалиста" });
    await user.click(screen.getByRole("button", { name: "Позвать специалиста" }));

    expect(await screen.findByText(/Ждём специалиста/)).toBeTruthy();
  });

  it("восстанавливается из ленты, а не живёт одним экраном", async () => {
    // Здесь и была поломка. Надпись дописывалась в список сообщений сразу
    // после ответа портала — и жила до первого обновления ленты. Поток
    // присылал «в разговоре новое», виджет перечитывал ленту с сервера
    // и заменял список целиком: надпись исчезала ровно тогда, когда
    // посетитель ждал. Она же не появлялась вовсе, если человек закрыл
    // вкладку и вернулся.
    //
    // Состояние ожидания приходит с портала вместе с лентой, и проверять
    // надо именно это: открыли виджет — разговор уже ждёт человека.
    mocks.chatThread.mockResolvedValue(
      лента([реплика("assistant", "Зову специалиста VEDAL.")], "waiting"),
    );

    await открыть();

    expect(await screen.findByText(/Ждём специалиста/)).toBeTruthy();
    // И кнопок при этом нет: разговор у человека.
    expect(screen.queryByRole("button", { name: "Запросить КП" })).toBeNull();
  });

  it("прячет кнопки: заготовка поверх живого человека — это машина, которая перебивает", async () => {
    const user = await открыть();
    await screen.findByRole("button", { name: "Позвать специалиста" });
    await user.click(screen.getByRole("button", { name: "Позвать специалиста" }));

    await screen.findByText(/Ждём специалиста/);
    expect(screen.queryByRole("button", { name: "Запросить КП" })).toBeNull();
  });
});

describe("лента", () => {
  it("показывается целиком, а не последними четырьмя репликами", async () => {
    mocks.chatThread.mockResolvedValue(
      лента([
        реплика("visitor", "первый вопрос"),
        реплика("assistant", "первый ответ"),
        реплика("visitor", "второй вопрос"),
        реплика("assistant", "второй ответ"),
        реплика("visitor", "третий вопрос"),
        реплика("assistant", "третий ответ"),
      ]),
    );

    await открыть();

    // Окно в четыре реплики съедало разговор на третьем вопросе: посетитель
    // терял и свой вопрос, и ссылки из ответа, а панель всё это время умела
    // прокручиваться.
    expect(await screen.findByText("первый вопрос")).toBeTruthy();
    expect(screen.getByText("третий ответ")).toBeTruthy();
  });

  it("«прочитано» ставится только на своём сообщении и только когда прочитали", async () => {
    mocks.chatThread.mockResolvedValue(
      лента([
        реплика("visitor", "мой вопрос", { readAt: "2026-08-21T09:31:00Z" }),
        реплика("visitor", "ещё вопрос"),
        реплика("staff", "ответ человека", { actor: "Ирина", readAt: "2026-08-21T09:32:00Z" }),
      ]),
    );

    await открыть();
    await screen.findByText("мой вопрос");

    // Отметка значит ровно одно: сообщение открыл живой человек. Ждущему
    // это важнее любой надписи о сроках — надпись обещание, отметка факт.
    const прочитано = screen.getAllByText(/прочитано/);
    expect(прочитано).toHaveLength(1);

    const своё = screen.getByText("мой вопрос").closest("div")!;
    expect(within(своё).getByText(/прочитано/)).toBeTruthy();
  });
});

describe("ожидание ответа", () => {
  // Ответ приезжает потоком — без него проверять здесь нечего.
  beforeEach(подключитьПоток);

  // Главное в новом устройстве разговора. Дверь отвечает сразу и БЕЗ ответа
  // Ведалины — он доезжает потоком, потому что модель считает секундами.
  // Погасив точки по возврату запроса, виджет показал бы пустое окно ровно
  // там, где ответ готовится: вопрос задан, ничего не происходит.
  it("не гаснет оттого, что дверь ответила: ответа в её ответе больше нет", async () => {
    const user = await открыть();
    await screen.findByRole("button", { name: "Запросить КП" });

    await user.click(screen.getByRole("button", { name: "Запросить КП" }));

    await waitFor(() => expect(mocks.sayInChat).toHaveBeenCalled());
    expect(screen.getByLabelText("Ведалина печатает")).toBeTruthy();
  });

  // Точки принадлежат порталу, а не окну. Виджет, открытый заново посреди
  // ожидания, обязан снова их показать: своё состояние он потерял, а вопрос
  // никуда не делся и ответ на него готовится.
  it("восстанавливается из ленты после перезагрузки страницы", async () => {
    mocks.chatThread.mockResolvedValue(принято("а что с доставкой?"));

    await открыть();

    expect(await screen.findByLabelText("Ведалина печатает")).toBeTruthy();
  });

  // Ответ пришёл — раздумье кончилось. Точки рядом с готовым ответом
  // означали бы, что портал пишет что-то ещё.
  it("гаснет, когда лента принесла ответ", async () => {
    mocks.chatThread.mockResolvedValue(принято("вопрос"));
    await открыть();
    await screen.findByLabelText("Ведалина печатает");

    mocks.chatThread.mockResolvedValue(lentaПосле("Ответ Ведалины"));
    await act(async () => ПоддельныйПоток.последний!.послать("changed"));

    expect(screen.queryByLabelText("Ведалина печатает")).toBeNull();
    expect(screen.getByText("Ответ Ведалины")).toBeTruthy();
  });

  // Текст, появляющийся на глазах, отвечает на вопрос «работает ли вообще»,
  // которого точки не дают.
  it("показывает недописанный ответ по кускам и убирает его, когда придёт лента", async () => {
    mocks.chatThread.mockResolvedValue(принято("вопрос"));
    await открыть();

    await act(async () =>
      ПоддельныйПоток.последний!.послать("draft", '{"chunk":"Инкубатор "}'),
    );
    await act(async () =>
      ПоддельныйПоток.последний!.послать("draft", '{"chunk":"VEDAL A-2000"}'),
    );

    // Куски склеиваются в порядке прихода: показанный черновик обязан
    // совпасть с тем, что придёт лентой.
    expect(screen.getByText("Инкубатор VEDAL A-2000")).toBeTruthy();
    // И точек при этом нет: текст на экране говорит больше, чем они.
    expect(screen.queryByLabelText("Ведалина печатает")).toBeNull();

    mocks.chatThread.mockResolvedValue(lentaПосле("Инкубатор VEDAL A-2000 — трансформер"));
    await act(async () => ПоддельныйПоток.последний!.послать("changed"));

    // Черновик обязан уйти: рядом с записанным ответом он показал бы
    // один и тот же текст дважды.
    expect(screen.queryByText("Инкубатор VEDAL A-2000")).toBeNull();
    expect(screen.getByText("Инкубатор VEDAL A-2000 — трансформер")).toBeTruthy();
  });

  // Портал сообщает о раздумье и событием — оно нужно тем окнам, где вопрос
  // задавали не в этой вкладке.
  it("зажигается по событию потока, а не только по своему нажатию", async () => {
    mocks.chatThread.mockResolvedValue(лента([реплика("visitor", "вопрос")]));
    await открыть();
    expect(screen.queryByLabelText("Ведалина печатает")).toBeNull();

    await act(async () =>
      ПоддельныйПоток.последний!.послать("typing", '{"who":"assistant"}'),
    );

    expect(screen.getByLabelText("Ведалина печатает")).toBeTruthy();
  });
});

// Перевод строки — правило CSS, и в jsdom стили модуля не подключаются:
// вычисленное значение здесь всегда одно и то же независимо от файла.
// Поэтому сторож читает сам файл, как это делают сторожа админки.
describe("переводы строк в ответе", () => {
  it("пузырь сообщения сохраняет их", () => {
    const css = readFileSync(join("components", "VedalinaChat.module.css"), "utf8");

    // Портал отдаёт перечень изделий списком через «—» с переводами строк.
    // Без этого правила браузер схлопывает их в пробелы, и список читается
    // одной строкой: текст верный, прочесть нельзя.
    const пузырь = css.slice(css.indexOf(".msg {"), css.indexOf("}", css.indexOf(".msg {")));
    expect(пузырь).toContain("white-space: pre-line");
  });
});

describe("живые обновления", () => {
  // Виджет слушал stream.onmessage, а портал шлёт event:changed.
  // onmessage срабатывает ТОЛЬКО на события без имени, поэтому обработчик
  // не вызывался ни разу: лента читалась при открытии и дальше не менялась.
  // Снаружи это выглядело так, будто ответ сотрудника и галочка «прочитано»
  // появляются лишь после перезагрузки страницы.
  //
  // Проверяются обе стороны: событие с именем ленту перечитывает, безымянное
  // — нет. Половина, требующая только первого, зеленела бы и на подписке
  // сразу на всё подряд, а это вернуло бы прежнюю путаницу другим боком.

  beforeEach(подключитьПоток);

  it("именованное событие перечитывает ленту", async () => {
    await открыть();
    const былоЧтений = mocks.chatThread.mock.calls.length;

    await act(async () => ПоддельныйПоток.последний!.послать("changed"));

    expect(mocks.chatThread.mock.calls.length).toBeGreaterThan(былоЧтений);
  });

  it("безымянное событие лентой не считается", async () => {
    await открыть();
    const былоЧтений = mocks.chatThread.mock.calls.length;

    await act(async () => ПоддельныйПоток.последний!.послать("message"));

    expect(mocks.chatThread.mock.calls.length).toBe(былоЧтений);
  });
});
