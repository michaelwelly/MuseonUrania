"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import LivePattern from "./LivePattern";
import { vedalina, quickReplies, answerFor } from "@/content/vedalina";
import { site } from "@/content/site";
import { consent as consentCopy } from "@/content/legal";
import {
  apiConfigured,
  callHuman,
  chatPrompts,
  chatStreamUrl,
  chatThread,
  pingTyping,
  raiseChatLead,
  sayInChat,
  visitorKey,
  type ChatLine,
  type ChatSupport,
  type Handoff,
  type Prompt,
  type Source,
} from "@/lib/submit";
import styles from "./VedalinaChat.module.css";

// Виджет ведёт РАЗГОВОР, а не задаёт разовые вопросы.
//
// Отличие видно не сразу, но оно меняет всё: когда Ведалина не находит ответа
// по опубликованному, разговор не заканчивается тупиком с телефоном — он
// встаёт в очередь к сотруднику, и дальше отвечает человек. Посетителю при
// этом видно, кто именно ответил: выдать ответ поиска за консультацию
// специалиста нельзя ни при каких обстоятельствах.
//
// Лента приходит с сервера целиком и рисуется целиком. Дописывать пришедшее
// к тому, что уже на экране, значит требовать, чтобы клиент и сервер одинаково
// понимали, где кончилось прошлое состояние, — а при обрыве связи они
// понимают это по-разному.

type Message = {
  from: "bot" | "me" | "staff";
  /** Имя сотрудника: посетитель должен видеть, что отвечает человек. */
  who?: string;
  text: string;
  sources?: Source[];
  /** Заполнен, когда подходящих опубликованных источников нет. */
  handoff?: Handoff;
  /** Когда написано. У приветствия пусто: его никто не отправлял. */
  at?: string;
  /**
   * Когда прочитано другой стороной. Показывается только у своих сообщений
   * и значит ровно одно: их увидел живой человек. Ждущему это важнее
   * любой надписи о сроках — она обещание, а отметка факт.
   */
  readAt?: string | null;
};

/** Часы и минуты. Разговор возвращаются читать через час и через день. */
function clock(iso?: string): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  return Number.isNaN(at.valueOf())
    ? null
    : at.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

const GREETING: Message = { from: "bot", text: vedalina.greeting };

/** Строка серверной ленты — в сообщение виджета. */
function toMessage(line: ChatLine): Message {
  if (line.author === "visitor") {
    return { from: "me", text: line.body, at: line.at, readAt: line.readAt };
  }
  if (line.author === "staff") {
    return {
      from: "staff",
      who: line.actor ?? "Специалист VEDAL",
      text: line.body,
      at: line.at,
    };
  }
  return {
    from: "bot",
    text: line.body,
    at: line.at,
    sources: line.sources?.length ? line.sources : undefined,
  };
}

/**
 * Сколько ждём ответа, прежде чем погасить точки.
 *
 * Страховка, а не срок. Ответ гасит их сам — событием потока; этот предел
 * нужен на случай, когда события не будет вовсе: поток оборвался, портал
 * перезапустился, ответ потерялся. Вечные точки хуже отсутствия точек:
 * человек ждёт того, чего уже не случится.
 *
 * Минута, а не десять секунд: у модели десять секунд — обычный ответ,
 * и погасшие на восьмой секунде точки означали бы «не дождался» ровно там,
 * где всё идёт по плану.
 */
const THINKING_LIMIT = 60_000;

/**
 * Обращение из разговора: контакты и согласие.
 *
 * <p>Спрашивается здесь, а не перед первым сообщением, и это разница между
 * «спросил и ушёл» и «спросил, не дождался, оставил контакты». Посетитель
 * анонимен ровно до этого места: ключ вкладки о человеке не сообщает ничего,
 * и согласие ему давать не на что.
 *
 * <p>Текст обращения не спрашивается: им становится переписка, которая уже
 * состоялась. Просить пересказать в форме то, что человек только что написал
 * в чат, — значит спросить дважды.
 */
function TicketForm({
  onSend,
  onCancel,
}: {
  onSend: (lead: {
    name: string;
    company: string;
    phone: string;
    email: string;
    consent: boolean;
  }) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className={styles.ticket}
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setSending(true);
        setError(
          await onSend({
            name: String(data.get("name") ?? "").trim(),
            company: String(data.get("company") ?? "").trim(),
            phone: String(data.get("phone") ?? "").trim(),
            email: String(data.get("email") ?? "").trim(),
            consent: Boolean(data.get("consent")),
          }),
        );
        setSending(false);
      }}
    >
      <p className={styles.ticketTitle}>Обращение специалисту</p>
      {/* Что произойдёт — сказано до того, как человек заполнит поля.
          «Оставьте контакты» без объяснения выглядит как сбор базы. */}
      <p className={styles.ticketNote}>
        Переписка приложится к обращению — пересказывать вопрос не нужно.
        Номер придёт на почту.
      </p>

      <input className={styles.ticketField} name="name" placeholder="Имя" required />
      <input
        className={styles.ticketField}
        name="company"
        placeholder="Организация (необязательно)"
      />
      <input
        className={styles.ticketField}
        name="phone"
        type="tel"
        placeholder="Телефон"
        required
      />
      <input
        className={styles.ticketField}
        name="email"
        type="email"
        placeholder="Почта"
        required
      />

      <label className={styles.ticketConsent}>
        <input type="checkbox" name="consent" required />
        <span>
          {consentCopy.label} —{" "}
          <a href={consentCopy.href}>{consentCopy.linkLabel}</a>
        </span>
      </label>

      {error && <p className={styles.ticketError}>{error}</p>}

      <div className={styles.ticketButtons}>
        <button type="submit" className={styles.ticketSend} disabled={sending}>
          {sending ? "Отправляем…" : "Отправить обращение"}
        </button>
        <button type="button" className={styles.ticketCancel} onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}

export default function VedalinaChat({ onClose }: { onClose?: () => void }) {
  const [list, setList] = useState<Message[]>([GREETING]);
  // Ведалина считает ответ.
  //
  // Раньше это был флаг, который виджет ставил себе сам на время запроса
  // и снимал по его завершении. Работало, пока ответ приходил в теле того же
  // запроса. Теперь ответ доезжает потоком, а значит ожидание переживает
  // и перезагрузку страницы, и вторую вкладку — и знает о нём портал,
  // а не только это окно.
  const [typing, setTyping] = useState(false);
  // Кусок ещё не дописанного ответа. Показывается как незаконченный и
  // заменяется лентой, как только ответ записан. Сам по себе он не значит
  // ничего: в базе его нет.
  const [answerDraft, setAnswerDraft] = useState("");
  const [draft, setDraft] = useState("");
  // Кнопки приходят с портала: подпись и заготовка, разложенные по двум
  // местам, расходятся на первой же правке — и расходятся молча.
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  // Разговор ждёт человека. Состояние, а не сообщение в ленте: сообщение
  // дописывалось после ответа и пропадало на первом же обновлении ленты
  // из потока — то есть исчезало ровно тогда, когда посетитель ждал.
  const [waiting, setWaiting] = useState(false);
  // Номер обращения, заведённого из этого разговора. Приходит с лентой:
  // человек, вернувшийся через неделю, обязан найти его там же, где оставил.
  const [leadNumber, setLeadNumber] = useState<string | null>(null);
  // Форма обращения раскрыта. Не отдельный экран: разговор остаётся на месте,
  // и видно, из чего обращение заводится.
  const [ticketForm, setTicketForm] = useState(false);
  // Отвечают ли сейчас люди. Приходит с лентой и меняется событием потока:
  // сотрудник, открывший админку, появляется на связи не тогда, когда
  // посетитель обновит страницу.
  //
  // Пока портал не ответил — null: «неизвестно» это не «оффлайн». Надпись
  // «сейчас никого нет», показанная до первого ответа портала, была бы
  // догадкой, и первое, что увидел бы посетитель, — сообщение о том,
  // что писать некому.
  const [support, setSupport] = useState<ChatSupport | null>(null);
  // Подсказка о часах работы раскрыта.
  const [hoursOpen, setHoursOpen] = useState(false);
  const feed = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visitor = useRef<string>("");
  // Сотрудник печатает. Живёт секунды и гаснет само: события «перестал»
  // не существует, человек волен просто закрыть вкладку.
  const [staffTyping, setStaffTyping] = useState(false);
  const fade = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Предел ожидания ответа Ведалины: страховка от вечных точек.
  const patience = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Когда последний раз сообщали, что посетитель печатает.
  const pinged = useRef(0);

  // Таймер ответа сбрасываем и при новом вопросе, и при размонтировании —
  // иначе быстрые клики по чипам наложат несколько ответов друг на друга.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Разговор продолжается между страницами и перезагрузками: ключ вкладки
  // лежит в браузере, лента подтягивается при открытии виджета.
  //
  // Подписка на поток — обычный EventSource: дверь публичная, токена не надо,
  // и переподключение при обрыве браузер делает сам. Благодаря ей ответ
  // сотрудника появляется у посетителя без перезагрузки страницы.
  useEffect(() => {
    if (!apiConfigured) return;
    visitor.current = visitorKey();
    let alive = true;

    void chatPrompts().then((loaded) => {
      if (alive) setPrompts(loaded);
    });

    const refresh = () =>
      void chatThread(visitor.current).then((thread) => {
        if (!alive || !thread) return;

        // Про людей портал отвечает всегда — и когда разговора ещё нет.
        // Виджет открывают до первого сообщения, и надпись в шапке нужна
        // ему уже тогда.
        if (thread.support) setSupport(thread.support);

        if (!thread.messages.length) return;

        // Точки гасит лента, а не таймер: пришедшая лента и есть ответ
        // на вопрос «дождались ли». Портал сообщает в ней же, думает ли
        // Ведалина прямо сейчас, — и это переживает перезагрузку страницы.
        thinking(thread.answering);

        // Черновик своё отработал: дальше на экране настоящая лента.
        // Оставить его рядом с записанным ответом значит показать текст
        // дважды.
        setAnswerDraft("");

        setWaiting(thread.status === "waiting");
        setLeadNumber(thread.leadNumber ?? null);
        setList([GREETING, ...thread.messages.map(toMessage)]);
      });

    refresh();

    const url = chatStreamUrl(visitor.current);
    if (!url) return;
    const stream = new EventSource(url);

    // Слушать надо ИМЕНОВАННОЕ событие, а не onmessage.
    //
    // onmessage срабатывает только на события без поля event, а портал шлёт
    // `event:changed`. Обработчик не вызывался ни разу: лента читалась один
    // раз при открытии и дальше не менялась. Снаружи это выглядело так,
    // будто ответ сотрудника и галочка «прочитано» появляются только после
    // перезагрузки страницы — что и происходило.
    //
    // Соседний обработчик typing работал именно потому, что подписан
    // по имени.
    stream.addEventListener("changed", refresh);

    // Кто-то печатает. Отдельный вид события, потому что перечитывать ленту
    // здесь незачем: в базе этого факта нет и не будет.
    stream.addEventListener("typing", (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as { who: string };
        if (!alive) return;

        // Ведалина взялась за ответ. Приходит из портала, а не ставится
        // виджетом по факту отправки: вопрос мог быть задан в другой вкладке.
        if (parsed.who === "assistant") {
          thinking(true);
          return;
        }

        if (parsed.who !== "staff") return;
        setStaffTyping(true);
        if (fade.current) clearTimeout(fade.current);
        // Гаснет по таймеру, и иначе нельзя: события «перестал печатать»
        // не существует — человек волен просто закрыть вкладку.
        fade.current = setTimeout(() => setStaffTyping(false), 5000);
      } catch {
        // Событие незнакомого вида — не повод рвать поток.
      }
    });

    // Специалист появился на связи или ушёл. Событие редкое — портал шлёт
    // его на переходах, а не на каждой открытой вкладке админки, — и ленту
    // по нему перечитывать незачем: о самом разговоре здесь не сказано ничего.
    stream.addEventListener("presence", (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as { online: boolean };
        if (!alive) return;
        // Часы работы остаются прежними: меняется присутствие, а не расписание.
        setSupport((was) => (was ? { ...was, online: parsed.online } : was));
      } catch {
        // Событие незнакомого вида — не повод рвать поток.
      }
    });

    // Кусок ответа, который ещё пишется. Единственное событие с текстом:
    // оно уходит только на этот ключ и повторится лентой через секунду.
    stream.addEventListener("draft", (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as { chunk: string };
        if (!alive || !parsed.chunk) return;
        thinking(true);
        setAnswerDraft((was) => was + parsed.chunk);
      } catch {
        // Битый кусок — не повод рвать поток и не повод показывать мусор.
      }
    });

    return () => {
      alive = false;
      stream.close();
      if (fade.current) clearTimeout(fade.current);
      if (patience.current) clearTimeout(patience.current);
    };
  }, []);

  /**
   * Зажечь или погасить точки Ведалины.
   *
   * Зажигая, заводим предел ожидания. Без него точки остаются навсегда,
   * если ответ не доедет вовсе: поток оборвался, портал перезапустился.
   * Человек в этом случае ждёт того, чего уже не будет, — и уходит,
   * решив, что чат сломан.
   */
  function thinking(on: boolean) {
    setTyping(on);
    if (patience.current) clearTimeout(patience.current);
    if (!on) return;
    patience.current = setTimeout(() => {
      setTyping(false);
      setAnswerDraft("");
    }, THINKING_LIMIT);
  }

  function ask(text: string, intent?: string) {
    const question = text.trim();
    if (!question) return;

    if (timer.current) clearTimeout(timer.current);
    setList((prev) => [...prev, { from: "me", text: question }]);
    setDraft("");
    thinking(true);

    // Без адреса API отвечаем локально: так чат работает в режиме вёрстки,
    // когда серверная часть не поднята.
    if (!apiConfigured) {
      timer.current = setTimeout(() => {
        setList((prev) => [...prev, { from: "bot", text: answerFor(question) }]);
        thinking(false);
      }, vedalina.replyDelay);
      return;
    }

    void sayInChat(visitor.current, question, intent).then((thread) => {
      if ("error" in thread) {
        thinking(false);
        // Портал молчит — отдаём живые контакты, а не оставляем тупик.
        setList((prev) => [
          ...prev,
          {
            from: "bot",
            text: thread.error,
            handoff: { reason: thread.error, phone: site.phone, email: site.email, forms: [] },
          },
        ]);
        return;
      }

      // Лента целиком: порядок сообщений определяет сервер, и «ответ на
      // позапрошлый вопрос» здесь взяться неоткуда.
      setList([GREETING, ...thread.messages.map(toMessage)]);

      // Точки НЕ гасим по возврату запроса — в нём ответа больше нет.
      //
      // Дверь принимает вопрос и отвечает сразу, а ответ доезжает потоком:
      // модель считает секундами, и ждать её внутри запроса значит держать
      // окно неподвижным, а поток обслуживания — занятым. Гасит точки лента,
      // пришедшая по событию, или предел ожидания.
      //
      // Исключение — нажатая кнопка: её текст известен заранее и приходит
      // сразу, и тогда портал не берётся считать ничего.
      thinking(thread.answering || lastIsVisitors(thread.messages));

      // Ответа могло не быть вовсе — тогда разговор ждёт человека.
      // Придумывать ответ запрещено правилами ассистента.
      setWaiting(thread.status === "waiting");
    });
  }

  /**
   * Отправить обращение.
   *
   * @return текст ошибки для показа в форме или `null`, если приняли.
   *         Ошибка возвращается, а не рисуется здесь: показать её обязана
   *         форма, рядом с кнопкой, которую нажали.
   */
  async function sendTicket(lead: {
    name: string;
    company: string;
    phone: string;
    email: string;
    consent: boolean;
  }): Promise<string | null> {
    if (!apiConfigured) return "Портал недоступен: обращение не отправлено.";

    const result = await raiseChatLead(visitor.current, lead);
    if ("error" in result) {
      // Разбор по полям приходит от портала; в узком окне чата показываем
      // первую ошибку, а не список: список из пяти строк вытеснит переписку.
      const first = result.fields ? Object.values(result.fields)[0] : null;
      return first ?? result.error;
    }

    setLeadNumber(result.number);
    setTicketForm(false);
    // Сообщение о номере портал уже дописал в ленту — она приедет событием.
    // Перечитываем сами на случай, если поток оборвался: номер обязан
    // оказаться на экране, он единственное, что человек унесёт с собой.
    void chatThread(visitor.current).then((thread) => {
      if (thread?.messages.length) setList([GREETING, ...thread.messages.map(toMessage)]);
    });
    return null;
  }

  /**
   * Последнее слово за посетителем — значит ответа ещё нет.
   *
   * Признак `answering` приходит из портала и точен, но между приёмом вопроса
   * и тем мигом, когда портал взялся считать, проходит мгновение: слушатель
   * запускается после записи. Попади ответ двери ровно в эту щель — точки
   * не зажглись бы вовсе, и окно на секунду выглядело бы так, будто вопрос
   * пропал.
   */
  function lastIsVisitors(messages: ChatLine[]): boolean {
    return messages.length > 0 && messages[messages.length - 1].author === "visitor";
  }

  /**
   * Позвать живого человека.
   *
   * Отдельная дверь, а не сообщение с особым текстом. Кнопка «Специалист
   * VEDAL» раньше отправляла свою подпись как вопрос — поиск отвечал на неё
   * каталогом, а разговор оставался у Ведалины: никого не звали.
   */
  function human() {
    if (waiting) return;

    if (!apiConfigured) {
      setList((prev) => [
        ...prev,
        {
          from: "bot",
          text: vedalina.handoffNote,
          handoff: { reason: vedalina.handoffNote, phone: site.phone, email: site.email, forms: [] },
        },
      ]);
      return;
    }

    thinking(true);
    void callHuman(visitor.current).then((thread) => {
      thinking(false);
      if ("error" in thread) {
        // Портал молчит — отдаём живые контакты, а не оставляем тупик.
        setList((prev) => [
          ...prev,
          {
            from: "bot",
            text: thread.error,
            handoff: { reason: thread.error, phone: site.phone, email: site.email, forms: [] },
          },
        ]);
        return;
      }
      setList([GREETING, ...thread.messages.map(toMessage)]);
      setWaiting(thread.status === "waiting");
    });
  }

  // Лента целиком, а не последние несколько сообщений. Окно в четыре
  // реплики съедало разговор на третьем вопросе: посетитель терял и свой
  // вопрос, и ссылки из ответа. Панель прокручивается — места хватает.
  const shown = list;

  // Без портала кнопки берутся из содержимого: иначе в режиме вёрстки,
  // когда серверная часть не поднята, окно остаётся вовсе без кнопок
  // и выглядит сломанным, а не ненастроенным.
  const shownPrompts: Prompt[] = prompts.length
    ? prompts
    : quickReplies.map((label) => ({
        intent: label,
        label,
        action: label === "Позвать специалиста" ? "handoff" : "ask",
      }));

  // Прокрутка вниз на каждое изменение: новое сообщение, появившееся ниже
  // видимой части, для посетителя не появилось вовсе.
  useEffect(() => {
    const box = feed.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [shown, typing, answerDraft, staffTyping, waiting]);

  return (
    <section className={styles.chat} aria-label={`Чат с ассистентом ${vedalina.name}`}>
      <div className={styles.head}>
        {/* Та же фактура, что на тёмных полосах страниц: чат — часть сайта,
            а не вставленный чужой виджет. Без квадратов и на 9%. */}
        <LivePattern variant={2} tone="dark" />

        {/* Размер пропами, а не fill — см. VedalinaWidget: fill выставляет
            картинке inset: 0, и отступ обёртки на неё не действует. */}
        <div className={styles.avatarWrap}>
          <Image
            className={styles.avatar}
            src={vedalina.avatar}
            alt={`Знак ассистента ${vedalina.name}`}
            width={36}
            height={36}
          />
          <span className={styles.status} aria-hidden="true" />
        </div>
        <div>
          <div className={styles.name}>{vedalina.name}</div>
          <div className={styles.role}>{vedalina.role}</div>

          {/* Кто на связи — про людей, а не про Ведалину: она отвечает всегда.
              Надпись говорит о факте (открыто ли рабочее место), а не о часах
              работы: «мы онлайн» по расписанию врёт в обеденный перерыв ровно
              тому, кто на неё понадеялся.

              Пока портал не ответил, надписи нет вовсе: «неизвестно» — это
              не «оффлайн», и встречать посетителя сообщением, что писать
              некому, было бы догадкой. */}
          {support && (
            <button
              type="button"
              className={support.online ? styles.presenceOn : styles.presenceOff}
              aria-expanded={hoursOpen}
              onClick={() => setHoursOpen((was) => !was)}
            >
              <span className={styles.presenceDot} aria-hidden="true" />
              {support.online ? "Специалист на связи" : "Специалисты офлайн"}
            </button>
          )}
        </div>
        {onClose && (
          <div className={styles.headTools}>
            <button
              type="button"
              className={styles.headButton}
              onClick={onClose}
              aria-label="Свернуть чат"
            >
              −
            </button>
            <button
              type="button"
              className={styles.headButton}
              onClick={onClose}
              aria-label="Закрыть чат"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Подсказка о часах работы. Раскрывается нажатием, а не всплывает
          по наведению: `title` браузера на телефоне не показывается вовсе,
          а именно там посетитель чаще всего и оказывается вечером.

          Держится под шапкой, а не в ленте: это свойство чата, а не реплика
          в разговоре, и прокруткой оно уезжать не должно. */}
      {support && hoursOpen && (
        <p className={styles.hours} aria-live="polite">
          Специалисты отвечают {support.hours}.{" "}
          {support.online
            ? "Сейчас кто-то на связи — ответит в этом окне."
            : support.openNow
              ? "Сейчас на связи никого нет. Можно писать здесь — прочитают, когда вернутся, — или оставить обращение: у него будет номер, и ответ придёт на почту."
              : "Сейчас нерабочее время. Можно писать здесь — прочитают утром, — или оставить обращение: у него будет номер, и ответ придёт на почту."}
        </p>
      )}

      <div className={styles.feed} aria-live="polite" ref={feed}>
        {shown.map((m, i) => (
          <div
            key={`${m.from}-${i}-${m.text.slice(0, 12)}`}
            className={`${styles.turn} ${m.from === "me" ? styles.turnMe : styles.turnBot}`}
          >
            {/* Подпись только у сотрудника. Посетитель должен видеть, что
                отвечает человек, а не машина: у Ведалины подпись есть в шапке
                окна, у самого посетителя она бессмысленна. */}
            {m.from === "staff" && <span className={styles.who}>{m.who}</span>}

            <p className={`${styles.msg} ${styles[m.from]}`}>{m.text}</p>

            {/* Время и отметка прочтения. Отметка стоит только у своих
                сообщений и значит ровно одно: их увидел живой человек.
                Ждущему это важнее любой надписи о сроках — надпись
                обещание, отметка факт. */}
            {(m.at || m.readAt) && (
              <span className={styles.meta}>
                {clock(m.at)}
                {m.from === "me" && m.readAt && (
                  <span className={styles.read}> · прочитано</span>
                )}
              </span>
            )}

            {/* Ответ обязан нести ссылки на источники: правило из спеки
                ассистента. Без них утверждение проверить нечем. */}
            {m.sources && (
              <ul className={styles.sources}>
                {m.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url}>{s.title}</a>
                  </li>
                ))}
              </ul>
            )}

            {m.handoff && (
              <p className={styles.handoff}>
                <a href={`tel:${m.handoff.phone.replace(/\s/g, "")}`}>{m.handoff.phone}</a>
                {" · "}
                <a href={`mailto:${m.handoff.email}`}>{m.handoff.email}</a>
              </p>
            )}
          </div>
        ))}

        {/* Ответ, который ещё пишется. Показывается вместо точек, как только
            приехал первый кусок: текст, появляющийся на глазах, — это ответ
            на вопрос «работает ли вообще», которого точки не дают.

            Курсор в конце обязателен. Без него незаконченный ответ выглядит
            как законченный, и посетитель уходит читать дальше на середине
            фразы. */}
        {answerDraft && (
          <p
            className={`${styles.msg} ${styles.bot} ${styles.answerDraft}`}
            aria-live="polite"
            aria-busy="true"
          >
            {answerDraft}
            <span className={styles.caret} aria-hidden="true" />
          </p>
        )}

        {typing && !answerDraft && (
          <p className={`${styles.msg} ${styles.bot} ${styles.typing}`} aria-label="Ведалина печатает">
            <span />
            <span />
            <span />
          </p>
        )}

        {/* Отвечает человек — и это надо сказать словом, а не теми же точками,
            что у Ведалины. Разница между «машина думает» и «специалист пишет»
            для ждущего посетителя существенная: во втором случае он готов
            подождать дольше. */}
        {staffTyping && (
          <p className={`${styles.msg} ${styles.staff} ${styles.staffTyping}`} aria-live="polite">
            Специалист печатает…
          </p>
        )}

        {/* Разговор ждёт человека. Полоса, а не сообщение в ленте: сообщение
            дописывалось после ответа и пропадало на первом же обновлении
            из потока — исчезало ровно тогда, когда посетитель ждал. */}
        {waiting && (
          <p className={styles.waiting} aria-live="polite">
            <span className={styles.waitingDot} aria-hidden="true" />
            {/* Ждать до утра и ждать десять минут — разные вещи, и говорить
                о них одинаково нельзя: «ответит в этом окне» в полночь человек
                прочтёт как «сейчас ответят», закроет вкладку и решит, что чат
                не работает. */}
            {support && !support.online
              ? `Ждём специалиста. На связи сейчас никого нет — отвечают ${support.hours}. Написанное здесь прочитают: `
              : "Ждём специалиста. Он ответит в этом окне — можно писать дальше, он прочитает всё. Не хотите ждать: "}
            <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>
            {" · "}
            <a href={`mailto:${site.email}`}>{site.email}</a>
          </p>
        )}

        {/* Обращение заведено. Плашка держится в ленте, а не проговаривается
            один раз сообщением: номер — единственное, что человек унесёт
            с собой, и искать его прокруткой через неделю он не станет.

            Ссылки «перейти к обращению» здесь нет намеренно: личного кабинета
            у посетителя нет, вести ей некуда, а придумать её значит обещать
            страницу, которой не существует. */}
        {leadNumber && (
          <p className={styles.ticketBadge} aria-live="polite">
            Обращение <b>{leadNumber}</b> · подтверждение отправлено на почту
          </p>
        )}

        {/* Форма обращения раскрывается прямо в ленте: разговор остаётся
            на месте, и видно, из чего обращение заводится. */}
        {ticketForm && !leadNumber && (
          <TicketForm onSend={sendTicket} onCancel={() => setTicketForm(false)} />
        )}

        {/* Позвать человека можно и не дожидаясь, пока Ведалина не найдёт
            ответа. Кнопка стоит и в ожидании: ждущий специалиста — первый,
            кому обращение и нужно, а разговор он мог начать в нерабочее
            время. */}
        {!ticketForm && !leadNumber && apiConfigured && (
          <button
            type="button"
            className={styles.ticketOpen}
            onClick={() => setTicketForm(true)}
            data-analytics="vedalina_ticket_open"
          >
            Создать обращение
          </button>
        )}

        {/* Кнопки молчат, когда в разговоре человек: заготовка поверх
            живого специалиста выглядит как сотрудник, который не читает,
            что ему пишут. */}
        {!waiting && (
          <div className={styles.chips}>
            {shownPrompts.map((p) => (
              <button
                key={p.intent}
                type="button"
                className={p.action === "handoff" ? styles.chipHuman : styles.chip}
                onClick={() => (p.action === "handoff" ? human() : ask(p.label, p.intent))}
                data-analytics="vedalina_quick_action_click"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        className={styles.inputRow}
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <input
          className={styles.input}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            // Не на каждую букву: раз в три секунды, пока поле не пустое.
            if (e.target.value.trim() && apiConfigured) {
              const now = Date.now();
              if (now - pinged.current >= 3000) {
                pinged.current = now;
                pingTyping(visitor.current);
              }
            }
          }}
          placeholder={vedalina.placeholder}
          aria-label={`Сообщение ассистенту ${vedalina.name}`}
        />
        <button type="submit" className={styles.send} aria-label="Отправить">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M2 8h11M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="square"
            />
          </svg>
        </button>
      </form>

      <p className={styles.disclaimer}>{vedalina.disclaimer}</p>
    </section>
  );
}
