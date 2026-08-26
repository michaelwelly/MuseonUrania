"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import LivePattern from "./LivePattern";
import { vedalina, quickReplies, answerFor } from "@/content/vedalina";
import { site } from "@/content/site";
import {
  apiConfigured,
  callHuman,
  chatPrompts,
  chatStreamUrl,
  chatThread,
  pingTyping,
  sayInChat,
  visitorKey,
  type ChatLine,
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

export default function VedalinaChat({ onClose }: { onClose?: () => void }) {
  const [list, setList] = useState<Message[]>([GREETING]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  // Кнопки приходят с портала: подпись и заготовка, разложенные по двум
  // местам, расходятся на первой же правке — и расходятся молча.
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  // Разговор ждёт человека. Состояние, а не сообщение в ленте: сообщение
  // дописывалось после ответа и пропадало на первом же обновлении ленты
  // из потока — то есть исчезало ровно тогда, когда посетитель ждал.
  const [waiting, setWaiting] = useState(false);
  const feed = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visitor = useRef<string>("");
  // Сотрудник печатает. Живёт секунды и гаснет само: события «перестал»
  // не существует, человек волен просто закрыть вкладку.
  const [staffTyping, setStaffTyping] = useState(false);
  const fade = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        if (!alive || !thread?.messages.length) return;
        setTyping(false);
        setWaiting(thread.status === "waiting");
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

    // Сотрудник печатает. Отдельный вид события, потому что перечитывать
    // ленту здесь незачем: в базе этого факта нет и не будет.
    stream.addEventListener("typing", (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as { who: string };
        if (parsed.who !== "staff" || !alive) return;
        setStaffTyping(true);
        if (fade.current) clearTimeout(fade.current);
        fade.current = setTimeout(() => setStaffTyping(false), 5000);
      } catch {
        // Событие незнакомого вида — не повод рвать поток.
      }
    });

    return () => {
      alive = false;
      stream.close();
      if (fade.current) clearTimeout(fade.current);
    };
  }, []);

  function ask(text: string, intent?: string) {
    const question = text.trim();
    if (!question) return;

    if (timer.current) clearTimeout(timer.current);
    setList((prev) => [...prev, { from: "me", text: question }]);
    setDraft("");
    setTyping(true);

    // Без адреса API отвечаем локально: так чат работает в режиме вёрстки,
    // когда серверная часть не поднята.
    if (!apiConfigured) {
      timer.current = setTimeout(() => {
        setList((prev) => [...prev, { from: "bot", text: answerFor(question) }]);
        setTyping(false);
      }, vedalina.replyDelay);
      return;
    }

    void sayInChat(visitor.current, question, intent).then((thread) => {
      setTyping(false);

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

      // Лента целиком: порядок сообщений определяет сервер, и «ответ на
      // позапрошлый вопрос» здесь взяться неоткуда.
      setList([GREETING, ...thread.messages.map(toMessage)]);

      // Ответа могло не быть вовсе — тогда разговор ждёт человека.
      // Придумывать ответ запрещено правилами ассистента.
      setWaiting(thread.status === "waiting");
    });
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

    setTyping(true);
    void callHuman(visitor.current).then((thread) => {
      setTyping(false);
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
  }, [shown, typing, staffTyping, waiting]);

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

        {typing && (
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
            Ждём специалиста. Он ответит в этом окне — можно писать дальше,
            он прочитает всё. Не хотите ждать:{" "}
            <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>
            {" · "}
            <a href={`mailto:${site.email}`}>{site.email}</a>
          </p>
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
