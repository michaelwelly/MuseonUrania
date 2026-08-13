"use client";

import { useState } from "react";
import { subscribe } from "@/content/news";
import { site } from "@/content/site";
import styles from "./page.module.css";

// Рассылки ещё нет. После валидного адреса честно говорим, что подписка не
// подключена, и даём рабочую почту. Ложное «вы подписаны» показывать нельзя.
export default function NewsSubscribe() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "invalid" | "pending">("idle");

  return (
    <form
      className={styles.subscribe}
      data-reveal="1"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setState(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "pending" : "invalid");
      }}
    >
      <h2 className={styles.subscribeTitle}>{subscribe.title}</h2>
      <p className={styles.subscribeText}>{subscribe.text}</p>

      <div className={styles.subscribeRow}>
        <input
          type="email"
          className={`${styles.input} ${state === "invalid" ? styles.invalid : ""}`}
          placeholder={subscribe.placeholder}
          aria-label={subscribe.placeholder}
          aria-invalid={state === "invalid"}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state !== "idle") setState("idle");
          }}
        />
        <button type="submit" className={styles.submit}>
          {subscribe.submit}
        </button>
      </div>

      {state === "invalid" && <p className={styles.result}>Проверьте адрес почты.</p>}
      {state === "pending" && (
        <p className={styles.result} role="status">
          Рассылка ещё не подключена. Напишите на {site.email} — добавим вас в список.
        </p>
      )}
    </form>
  );
}
