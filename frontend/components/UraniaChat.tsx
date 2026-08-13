"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { urania, quickReplies, answerFor } from "@/content/urania";
import { site } from "@/content/site";
import { apiConfigured, askUrania, type Handoff, type Source } from "@/lib/submit";
import styles from "./UraniaChat.module.css";

type Message = {
  from: "bot" | "me";
  text: string;
  sources?: Source[];
  /** Заполнен, когда подходящих опубликованных источников нет. */
  handoff?: Handoff;
};

export default function UraniaChat({ onClose }: { onClose?: () => void }) {
  const [list, setList] = useState<Message[]>([{ from: "bot", text: urania.greeting }]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Считаем вопросы, чтобы не показать ответ на позапрошлый: сеть может
  // вернуть их не в том порядке, в каком их задали.
  const asked = useRef(0);

  // Таймер ответа сбрасываем и при новом вопросе, и при размонтировании —
  // иначе быстрые клики по чипам наложат несколько ответов друг на друга.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
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

    const turn = ++asked.current;
    void askUrania(question).then((reply) => {
      if (turn !== asked.current) return;
      setTyping(false);

      if ("error" in reply) {
        // Ассистент молчит — отдаём живые контакты, а не оставляем тупик.
        setList((prev) => [
          ...prev,
          {
            from: "bot",
            text: reply.error,
            handoff: { reason: reply.error, phone: site.phone, email: site.email, forms: [] },
          },
        ]);
        return;
      }

      // Ответа может не быть вовсе — тогда бэкенд отдаёт передачу человеку.
      // Придумывать ответ вместо неё запрещено правилами ассистента.
      setList((prev) => [
        ...prev,
        {
          from: "bot",
          text: reply.answer ?? reply.handoff?.reason ?? urania.greeting,
          sources: reply.sources?.length ? reply.sources : undefined,
          handoff: reply.answer ? undefined : (reply.handoff ?? undefined),
        },
      ]);
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
