"use client";

import { useState } from "react";
import { footer, site } from "@/content/site";
import styles from "./Footer.module.css";

// Подписка на релизы. Рассылки и бэкенда ещё нет, поэтому после валидного
// адреса честно говорим, что подписка не подключена, и даём рабочую почту.
// Ложное «вы подписаны» показывать нельзя. Заменить на POST в API.
export default function FooterSubscribe() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "invalid" | "pending">("idle");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    setState(ok ? "pending" : "invalid");
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <p className={styles.colTitle}>{footer.subscribe.title}</p>
      <div className={styles.subscribeRow}>
        <input
          type="email"
          className={`${styles.subscribeInput} ${state === "invalid" ? styles.subscribeInvalid : ""}`}
          placeholder={footer.subscribe.placeholder}
          aria-label={footer.subscribe.placeholder}
          aria-invalid={state === "invalid"}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state !== "idle") setState("idle");
          }}
        />
        <button type="submit" className={styles.subscribeButton} aria-label="Подписаться">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M2 8h11M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="square"
            />
          </svg>
        </button>
      </div>

      {state === "invalid" && <p className={styles.subscribeResult}>Проверьте адрес почты.</p>}
      {state === "pending" && (
        <p className={styles.subscribeResult} role="status">
          Рассылка ещё не подключена. Напишите на {site.email} — добавим вас в список.
        </p>
      )}

      <p className={styles.subscribeNote}>{footer.subscribe.note}</p>
    </form>
  );
}
