"use client";

import { useState } from "react";
import { site } from "@/content/site";
import { homeCta } from "@/content/home";
import styles from "./HomeLeadForm.module.css";

type Errors = Partial<Record<"phone" | "message", string>>;

// Короткая форма первого экрана: организация, телефон, задача. Полная форма
// с согласием и выбором изделия живёт на /contacts/ и /service/.
export default function HomeLeadForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [tried, setTried] = useState(false);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const get = (k: string) => String(data.get(k) ?? "").trim();

    const found: Errors = {};
    if (get("phone").replace(/\D/g, "").length < 10) found.phone = "Укажите телефон с кодом";
    if (get("message").length < 10) found.message = "Опишите задачу хотя бы одной фразой";

    setErrors(found);
    setTried(true);
  }

  // ponytail: CRM и Integration Gateway ещё не построены — вместо ложного
  // «отправлено» показываем рабочие контакты. Заменить на POST в API.
  const showPending = tried && Object.keys(errors).length === 0;

  return (
    <form className={styles.card} onSubmit={onSubmit} noValidate>
      <div className={styles.row}>
        <div className={styles.field}>
          <input
            className={styles.input}
            name="company"
            placeholder="Организация"
            aria-label="Организация"
            autoComplete="organization"
          />
        </div>
        <div className={styles.field}>
          <input
            className={`${styles.input} ${errors.phone ? styles.invalid : ""}`}
            name="phone"
            type="tel"
            placeholder="Телефон"
            aria-label="Телефон"
            autoComplete="tel"
            aria-invalid={!!errors.phone}
          />
          {errors.phone && <span className={styles.error}>{errors.phone}</span>}
        </div>
      </div>

      <textarea
        className={`${styles.textarea} ${errors.message ? styles.invalid : ""}`}
        name="message"
        placeholder="Задача отделения, модель или вопрос"
        aria-label="Сообщение"
        aria-invalid={!!errors.message}
      />
      {errors.message && <span className={styles.error}>{errors.message}</span>}

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} data-analytics="quote_form_submit">
          Отправить запрос
        </button>
        <span className={styles.note}>{homeCta.note}</span>
      </div>

      {showPending && (
        <p className={styles.pending} role="status" data-anim="rise">
          Отправка заявок подключается вместе с CRM. Пока позвоните{" "}
          <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a> или напишите на{" "}
          <a href={`mailto:${site.email}`}>{site.email}</a>.
        </p>
      )}
    </form>
  );
}
