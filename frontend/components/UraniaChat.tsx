"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { urania, quickReplies, answerFor } from "@/content/urania";
import styles from "./UraniaChat.module.css";

type Message = { from: "bot" | "me"; text: string };

export default function UraniaChat() {
  const [list, setList] = useState<Message[]>([{ from: "bot", text: urania.greeting }]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    timer.current = setTimeout(() => {
      setList((prev) => [...prev, { from: "bot", text: answerFor(question) }]);
      setTyping(false);
    }, urania.replyDelay);
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
        <div className={styles.headTools} aria-hidden="true">
          <button type="button" className={styles.headButton} tabIndex={-1}>
            −
          </button>
          <button type="button" className={styles.headButton} tabIndex={-1}>
            ×
          </button>
        </div>
      </div>

      <div className={styles.feed} aria-live="polite">
        {shown.map((m, i) => (
          <p key={`${m.from}-${i}-${m.text.slice(0, 12)}`} className={`${styles.msg} ${styles[m.from]}`}>
            {m.text}
          </p>
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
