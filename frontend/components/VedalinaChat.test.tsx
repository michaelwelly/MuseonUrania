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
  raiseChatLead: vi.fn(),
  rateAnswer: vi.fn(),
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
  raiseChatLead: mocks.raiseChatLead,
  rateAnswer: mocks.rateAnswer,
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

const НА_СВЯЗИ = { online: true, openNow: true, hours: "Пн–Пт 9:00–18:00 (Екатеринбург)" };
const НИКОГО = { online: false, openNow: false, hours: "Пн–Пт 9:00–18:00 (Екатеринбург)" };

function лента(
  messages: unknown[],
  status = "open",
  answering = false,
  leadNumber: string | null = null,
  support: unknown = НА_СВЯЗИ,
) {
  return { id: "разговор-1", status, messages, answering, leadNumber, support };
}

let счётчик = 0;

function реплика(author: string, body: string, extra: Record<string, unknown> = {}) {
  return {
    // Идентификатор нужен оценке: «этот ответ не помог» надо к чему-то
    // отнести. Свой у каждой реплики — портал их не повторяет.
    id: `сообщение-${++счётчик}`,
    helpful: null,
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
  mocks.raiseChatLead.mockReset().mockResolvedValue({ number: "З-2026-0042" });
  mocks.rateAnswer.mockReset().mockResolvedValue(лента([]));
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
    //
    // Отметок ровно две, и обе на своих сообщениях: у чужих её быть не может
    // вовсе — «прочитано» показывают тому, кто писал, а не тому, кто читал.
    expect(screen.getAllByLabelText("Прочитано")).toHaveLength(1);
    expect(screen.getAllByLabelText("Доставлено")).toHaveLength(1);

    const своё = screen.getByText("мой вопрос").closest("div")!;
    expect(within(своё).getByLabelText("Прочитано")).toBeTruthy();

    // Ответ сотрудника прочитан посетителем, но отметки на нём нет: она
    // адресована тому, кто писал, а пишет её видит в своей админке.
    const чужое = screen.getByText("ответ человека").closest("div")!;
    expect(within(чужое).queryByLabelText("Прочитано")).toBeNull();
  });

  // Доставку и прочтение различать обязательно: ждущему важно, дошло ли
  // сообщение до людей, а не до сервера.
  it("одна галочка — доставлено, две — прочитано", async () => {
    mocks.chatThread.mockResolvedValue(
      лента([
        реплика("visitor", "дошло", { readAt: "2026-08-21T09:31:00Z" }),
        реплика("visitor", "ещё не читали"),
      ]),
    );

    await открыть();
    await screen.findByText("дошло");

    expect(within(screen.getByText("дошло").closest("div")!).getByText("✓✓")).toBeTruthy();
    expect(
      within(screen.getByText("ещё не читали").closest("div")!).getByText("✓"),
    ).toBeTruthy();
  });

  // Разговор возвращаются читать через час и через неделю: без разделителя
  // вчерашний ответ выглядит написанным только что.
  it("делится разделителями дней", async () => {
    const сегодня = new Date();
    const вчера = new Date(сегодня);
    вчера.setDate(сегодня.getDate() - 1);

    mocks.chatThread.mockResolvedValue(
      лента([
        реплика("visitor", "вчерашний вопрос", { at: вчера.toISOString() }),
        реплика("assistant", "сегодняшний ответ", { at: сегодня.toISOString() }),
      ]),
    );

    await открыть();

    expect(await screen.findByText("Вчера")).toBeTruthy();
    expect(screen.getByText("Сегодня")).toBeTruthy();
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

describe("источники в ответе", () => {
  const ИСТОЧНИКИ = [
    { title: "VEDAL A-2000 — Инкубатор-трансформер", url: "/products/vedal-a-2000/" },
    { title: "VEDAL R2 — Система дыхательная", url: "/products/vedal-r2/" },
  ];

  // Маркеры вида [1] умеет ставить модель, а детерминированный поиск — нет:
  // он не знает, какая фраза из какого материала. Разбор существует заранее,
  // чтобы появление модели не потребовало переделки ленты.
  it("маркер в тексте становится ссылкой на источник", async () => {
    mocks.chatThread.mockResolvedValue(
      лента([
        реплика("assistant", "Инкубатор-трансформер [1] и дыхательная система [2].", {
          sources: ИСТОЧНИКИ,
        }),
      ]),
    );

    await открыть();

    const первая = await screen.findByRole("link", { name: "1" });
    expect(первая.getAttribute("href")).toBe("/products/vedal-a-2000/");
    expect(screen.getByRole("link", { name: "2" }).getAttribute("href")).toBe(
      "/products/vedal-r2/",
    );
  });

  // Ссылка в никуда хуже её отсутствия: по ней нажмут.
  it("маркер на несуществующий источник остаётся текстом", async () => {
    mocks.chatThread.mockResolvedValue(
      лента([
        реплика("assistant", "Ответ со сноской [7].", { sources: [ИСТОЧНИКИ[0]] }),
      ]),
    );

    await открыть();

    await screen.findByText(/Ответ со сноской/);
    expect(screen.queryByRole("link", { name: "7" })).toBeNull();
  });

  // Список нумерованный, потому что номера в нём — те же, что в маркерах:
  // маркированный оставил бы сноски указывающими ни на что.
  it("источники перечислены под ответом", async () => {
    mocks.chatThread.mockResolvedValue(
      лента([реплика("assistant", "Ответ.", { sources: ИСТОЧНИКИ })]),
    );

    await открыть();

    expect(
      await screen.findByRole("link", { name: "VEDAL A-2000 — Инкубатор-трансформер" }),
    ).toBeTruthy();
  });
});

describe("новые сообщения", () => {
  // Граница считается по времени последнего открытия виджета, а не по
  // отметке «прочитано»: ту портал ставит в момент, когда отдаёт ленту,
  // — то есть к приходу она уже проставлена.
  it("отделяют то, что пришло с прошлого раза", async () => {
    const давно = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const только_что = new Date().toISOString();
    localStorage.setItem("vedal.chat.seen", String(Date.now() - 30 * 60 * 1000));

    mocks.chatThread.mockResolvedValue(
      лента([
        реплика("visitor", "старый вопрос", { at: давно }),
        реплика("assistant", "старый ответ", { at: давно }),
        реплика("staff", "свежий ответ", { at: только_что, actor: "Ирина" }),
      ]),
    );

    await открыть();

    expect(await screen.findByText("Новые сообщения")).toBeTruthy();
  });

  // Первый приход — не повод рисовать границу: человек не видел ещё ничего,
  // и «новые» относительно ничего смысла не имеют.
  it("не рисуются, когда виджет открыт впервые", async () => {
    localStorage.removeItem("vedal.chat.seen");
    mocks.chatThread.mockResolvedValue(
      лента([реплика("assistant", "ответ", { at: new Date().toISOString() })]),
    );

    await открыть();

    await screen.findByText("ответ");
    expect(screen.queryByText("Новые сообщения")).toBeNull();
  });

  // Свои сообщения границей не считаются: посетитель их видел, когда писал.
  it("не считают своё сообщение новым", async () => {
    localStorage.setItem("vedal.chat.seen", String(Date.now() - 30 * 60 * 1000));
    mocks.chatThread.mockResolvedValue(
      лента([реплика("visitor", "мой свежий вопрос", { at: new Date().toISOString() })]),
    );

    await открыть();

    await screen.findByText("мой свежий вопрос");
    expect(screen.queryByText("Новые сообщения")).toBeNull();
  });
});

describe("оценка ответа", () => {
  const ОТВЕТ = () =>
    лента([
      реплика("visitor", "вопрос"),
      реплика("assistant", "Ответ Ведалины", { id: "ответ-1" }),
    ]);

  it("уходит на портал вместе с тем, какой ответ оценили", async () => {
    mocks.chatThread.mockResolvedValue(ОТВЕТ());
    mocks.rateAnswer.mockResolvedValue(ОТВЕТ());

    const user = await открыть();
    await screen.findByText("Ответ Ведалины");

    await user.click(screen.getByLabelText("Ответ не помог"));

    // Идентификатор, а не номер в ленте: номер съезжает от каждой новой реплики.
    await waitFor(() =>
      expect(mocks.rateAnswer).toHaveBeenCalledWith("ключ-вкладки", "ответ-1", false),
    );
  });

  // Оценивают машину. «Специалист не помог» — это не оценка ответа, а жалоба
  // на человека, и разбирать её кнопкой в чате нельзя.
  it("не предлагается под ответом сотрудника и под своим сообщением", async () => {
    mocks.chatThread.mockResolvedValue(
      лента([
        реплика("visitor", "мой вопрос"),
        реплика("staff", "ответ человека", { actor: "Ирина" }),
      ]),
    );

    await открыть();
    await screen.findByText("ответ человека");

    expect(screen.queryByLabelText("Ответ помог")).toBeNull();
    expect(screen.queryByLabelText("Ответ не помог")).toBeNull();
  });

  // Состояние приходит с портала лентой: нажатие, нарисованное на месте
  // и не сохранившееся, — это оценка, которую никто не увидит.
  it("нажатая оценка видна и после возвращения к разговору", async () => {
    mocks.chatThread.mockResolvedValue(
      лента([
        реплика("visitor", "вопрос"),
        реплика("assistant", "Ответ Ведалины", { helpful: false }),
      ]),
    );

    await открыть();
    await screen.findByText("Ответ Ведалины");

    expect(screen.getByLabelText("Ответ не помог").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("Ответ помог").getAttribute("aria-pressed")).toBe("false");
  });

  // Нажавшему «не помог» нужен выход, а не благодарность за отзыв: он остался
  // без ответа, и это единственное, что его сейчас занимает.
  it("после «не помог» предлагает специалиста", async () => {
    mocks.chatThread.mockResolvedValue(
      лента([
        реплика("visitor", "вопрос"),
        реплика("assistant", "Ответ Ведалины", { helpful: false }),
      ]),
    );

    const user = await открыть();
    await screen.findByText("Ответ Ведалины");

    // Кнопка ищется внутри пузыря: такая же есть среди чипов внизу окна,
    // и по всему экрану их две.
    const ответ = screen.getByText("Ответ Ведалины").closest("div")!;
    await user.click(within(ответ).getByRole("button", { name: "Позвать специалиста" }));

    await waitFor(() => expect(mocks.callHuman).toHaveBeenCalledWith("ключ-вкладки"));
  });
});

describe("кто на связи", () => {
  beforeEach(подключитьПоток);

  // Надпись говорит о людях, а не о портале: Ведалина отвечает всегда,
  // и «онлайн» про неё ничего не значит.
  it("показывает присутствие специалиста по факту, а не по расписанию", async () => {
    mocks.chatThread.mockResolvedValue(лента([реплика("visitor", "вопрос")], "open", false, null, НА_СВЯЗИ));

    await открыть();

    expect(await screen.findByRole("button", { name: /Специалист на связи/ })).toBeTruthy();
  });

  it("говорит «офлайн», когда рабочих мест не открыто", async () => {
    mocks.chatThread.mockResolvedValue(лента([реплика("visitor", "вопрос")], "open", false, null, НИКОГО));

    await открыть();

    expect(await screen.findByRole("button", { name: /Специалисты офлайн/ })).toBeTruthy();
  });

  // «Неизвестно» — это не «оффлайн». Встречать посетителя сообщением, что
  // писать некому, до того как портал ответил, значит гадать.
  it("молчит, пока портал не ответил", async () => {
    mocks.chatThread.mockResolvedValue(null);

    await открыть();

    expect(screen.queryByRole("button", { name: /Специалист/ })).toBeNull();
  });

  // Часы работы — нажатием, а не всплывающей подсказкой: `title` на телефоне
  // не показывается вовсе, а именно там посетитель и оказывается вечером.
  it("часы работы раскрываются нажатием на статус", async () => {
    mocks.chatThread.mockResolvedValue(лента([реплика("visitor", "вопрос")], "open", false, null, НИКОГО));

    const user = await открыть();
    await user.click(await screen.findByRole("button", { name: /Специалисты офлайн/ }));

    expect(screen.getByText(/Пн–Пт 9:00–18:00/)).toBeTruthy();
    // И сказано, что делать: обращение переживёт закрытую вкладку.
    expect(screen.getByText(/оставить обращение/)).toBeTruthy();
  });

  // Присутствие меняется без перезагрузки страницы: сотрудник, открывший
  // админку, появляется на связи сразу.
  it("зажигается по событию потока", async () => {
    mocks.chatThread.mockResolvedValue(лента([реплика("visitor", "вопрос")], "open", false, null, НИКОГО));
    await открыть();
    await screen.findByRole("button", { name: /Специалисты офлайн/ });

    await act(async () =>
      ПоддельныйПоток.последний!.послать("presence", '{"online":true}'),
    );

    expect(screen.getByRole("button", { name: /Специалист на связи/ })).toBeTruthy();
  });

  // Ждать до утра и ждать десять минут — разные вещи. «Ответит в этом окне»
  // в полночь человек прочтёт как «сейчас ответят».
  it("в ожидании специалиста говорит, что на связи никого нет", async () => {
    mocks.chatThread.mockResolvedValue(
      лента([реплика("assistant", "Зову специалиста.")], "waiting", false, null, НИКОГО),
    );

    await открыть();

    expect(await screen.findByText(/На связи сейчас никого нет/)).toBeTruthy();
  });
});

describe("обращение из разговора", () => {
  async function заполнить(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByPlaceholderText("Имя"), "Ирина Петрова");
    await user.type(screen.getByPlaceholderText("Телефон"), "+7 343 300-00-00");
    await user.type(screen.getByPlaceholderText("Почта"), "i.petrova@example.ru");
    await user.click(screen.getByRole("checkbox"));
  }

  it("контакты и согласие спрашиваются здесь, а не перед первым вопросом", async () => {
    const user = await открыть();

    // До нажатия посетитель анонимен, и это намеренно: форма «представьтесь»
    // перед первым вопросом отсекает большую часть тех, кто хотел спросить
    // быстро.
    expect(screen.queryByPlaceholderText("Имя")).toBeNull();

    await user.click(await screen.findByRole("button", { name: "Создать обращение" }));

    expect(screen.getByPlaceholderText("Имя")).toBeTruthy();
    expect(screen.getByPlaceholderText("Телефон")).toBeTruthy();
    expect(screen.getByPlaceholderText("Почта")).toBeTruthy();
    // Согласие — галочка со ссылкой на политику, тот же текст, что в формах
    // сайта: бэкенд хранит версию текста, под которым человек подписался,
    // и две редакции превратили бы это в загадку.
    expect(screen.getByRole("checkbox")).toBeTruthy();
  });

  it("отправляет контакты и показывает номер обращения", async () => {
    const user = await открыть();
    await user.click(await screen.findByRole("button", { name: "Создать обращение" }));

    await заполнить(user);
    await user.click(screen.getByRole("button", { name: "Отправить обращение" }));

    await waitFor(() =>
      expect(mocks.raiseChatLead).toHaveBeenCalledWith("ключ-вкладки", {
        name: "Ирина Петрова",
        company: "",
        phone: "+7 343 300-00-00",
        email: "i.petrova@example.ru",
        consent: true,
      }),
    );

    // Номер — единственное, что человек унесёт с собой.
    expect(await screen.findByText(/З-2026-0042/)).toBeTruthy();
  });

  it("номер восстанавливается из ленты, а не живёт одним экраном", async () => {
    // Человек, вернувшийся через неделю, обязан найти номер там же, где
    // оставил: искать его прокруткой по переписке он не станет.
    mocks.chatThread.mockResolvedValue(
      лента([реплика("visitor", "вопрос")], "open", false, "З-2026-0007"),
    );

    await открыть();

    expect(await screen.findByText(/З-2026-0007/)).toBeTruthy();
    // И второй раз заводить обращение уже не предлагается.
    expect(screen.queryByRole("button", { name: "Создать обращение" })).toBeNull();
  });

  it("ошибку портала показывает в форме, а не молчит", async () => {
    mocks.raiseChatLead.mockResolvedValue({
      error: "Обращение не отправлено",
      fields: { phone: "Укажите телефон с кодом" },
    });

    const user = await открыть();
    await user.click(await screen.findByRole("button", { name: "Создать обращение" }));
    await заполнить(user);
    await user.click(screen.getByRole("button", { name: "Отправить обращение" }));

    // Разбор по полям приходит от портала — в узком окне показываем первую
    // ошибку, а не список: список из пяти строк вытеснит переписку.
    expect(await screen.findByText("Укажите телефон с кодом")).toBeTruthy();
    expect(screen.queryByText(/З-2026-0042/)).toBeNull();
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
