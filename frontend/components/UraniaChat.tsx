"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { urania, quickReplies, answerFor } from "@/content/urania";
import { site } from "@/content/site";
import {
  apiConfigured,
  chatStreamUrl,
  chatThread,
  sayInChat,
  visitorKey,
  type ChatLine,
  type Handoff,
  type Source,
} from "@/lib/submit";
import styles from "./UraniaChat.module.css";

// Виджет ведёт РАЗГОВОР, а не задаёт разовые вопросы.
//
// Отличие видно не сразу, но оно меняет всё: когда Урания не находит ответа
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
};

const GREETING: Message = { from: "bot", text: urania.greeting };

/** Строка серверной ленты — в сообщение виджета. */
function toMessage(line: ChatLine): Message {
  if (line.author === "visitor") return { from: "me", text: line.body };
  if (line.author === "staff") {
    return { from: "staff", who: line.actor ?? "Специалист VEDAL", text: line.body };
  }
  return {
    from: "bot",
    text: line.body,
    sources: line.sources?.length ? line.sources : undefined,
  };
}

export default function UraniaChat({ onClose }: { onClose?: () => void }) {
  const [list, setList] = useState<Message[]>([GREETING]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visitor = useRef<string>("");

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

    const refresh = () =>
      void chatThread(visitor.current).then((thread) => {
        if (!alive || !thread?.messages.length) return;
        setTyping(false);
        setList([GREETING, ...thread.messages.map(toMessage)]);
      });

    refresh();

    const url = chatStreamUrl(visitor.current);
    if (!url) return;
    const stream = new EventSource(url);
    stream.onmessage = refresh;

    return () => {
      alive = false;
      stream.close();
    };
  }, []);

  function ask(text: string) {
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
      }, urania.replyDelay);
      return;
    }

    void sayInChat(visitor.current, question).then((thread) => {
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

      // Ответа могло не быть вовсе — тогда разговор ждёт человека, и вместо
      // выдумки посетитель получает контакты. Придумывать ответ запрещено
      // правилами ассистента.
      if (thread.status === "waiting") {
        setList((prev) => [
          ...prev,
          {
            from: "bot",
            text: urania.handoffNote,
            handoff: { reason: urania.handoffNote, phone: site.phone, email: site.email, forms: [] },
          },
        ]);
      }
    });
  }

  const shown = list.slice(-urania.windowSize);

  return (
    <section className={styles.chat} aria-label={`Чат с ассистентом ${urania.name}`}>
      <div className={styles.head}>
        <div className={styles.avatarWrap}>
          <Image
            className={styles.avatar}
            src={urania.avatar}
            alt={`Аватар ассистента ${urania.name}`}
            fill
            sizes="44px"
          />
          <span className={styles.status} aria-hidden="true" />
        </div>
        <div>
          <div className={styles.name}>{urania.name}</div>
          <div className={styles.role}>{urania.role}</div>
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

      <div className={styles.feed} aria-live="polite">
        {shown.map((m, i) => (
          <div
            key={`${m.from}-${i}-${m.text.slice(0, 12)}`}
            className={`${styles.turn} ${m.from === "me" ? styles.turnMe : styles.turnBot}`}
          >
            {/* Подпись только у сотрудника. Посетитель должен видеть, что
                отвечает человек, а не машина: у Урании подпись есть в шапке
                окна, у самого посетителя она бессмысленна. */}
            {m.from === "staff" && <span className={styles.who}>{m.who}</span>}

            <p className={`${styles.msg} ${styles[m.from]}`}>{m.text}</p>

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
          <p className={`${styles.msg} ${styles.bot} ${styles.typing}`} aria-label="Урания печатает">
            <span />
            <span />
            <span />
          </p>
        )}

        <div className={styles.chips}>
          {quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              className={styles.chip}
              onClick={() => ask(q)}
              data-analytics="urania_quick_action_click"
            >
              {q}
            </button>
          ))}
        </div>
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
          onChange={(e) => setDraft(e.target.value)}
          placeholder={urania.placeholder}
          aria-label={`Сообщение ассистенту ${urania.name}`}
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

      <p className={styles.disclaimer}>{urania.disclaimer}</p>
    </section>
  );
}
