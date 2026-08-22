"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { site } from "@/content/site";
import { consent as consentCopy } from "@/content/legal";
import { newIdempotencyKey, submitLead } from "@/lib/submit";
import styles from "./HomeLeadForm.module.css";

type Errors = Partial<Record<"name" | "phone" | "email" | "message" | "consent", string>>;

// Короткая форма первого экрана. Полная, с выбором изделия, живёт
// на /contacts/ и /service/.
//
// Имя и почта здесь появились не для симметрии: Forms API их требует, без них
// заявка не создаётся.
//
// Согласие раньше проставлялось само — форма отправляла consent: true, а под
// кнопкой стояла подпись «нажимая кнопку, вы соглашаетесь». §14.6 плана
// требует явную галочку: подпись под кнопкой не даёт человеку выбора,
// а бэкенд при этом сохраняет согласие так, будто выбор был.
export default function HomeLeadForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [notice, setNotice] = useState("");
  const idempotencyKey = useRef(newIdempotencyKey());

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const data = new FormData(formEl);
    const get = (k: string) => String(data.get(k) ?? "").trim();

    const found: Errors = {};
    if (!get("name")) found.name = "Как к вам обращаться";
    if (get("phone").replace(/\D/g, "").length < 10) found.phone = "Укажите телефон с кодом";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get("email"))) found.email = "Проверьте адрес почты";
    if (get("message").length < 10) found.message = "Опишите задачу хотя бы одной фразой";
    if (!data.get("consent")) found.consent = consentCopy.error;

    setErrors(found);
    if (Object.keys(found).length > 0) {
      // То же, что и в LeadForm: без переноса фокуса отправка для незрячего
      // посетителя выглядит как «ничего не произошло».
      const order = ["name", "phone", "email", "message", "consent"] as const;
      const first = order.find((field) => found[field]);
      const control = first ? formEl.elements.namedItem(first) : null;
      if (control instanceof HTMLElement) control.focus();
      return;
    }

    setStatus("sending");
    const result = await submitLead(
      {
        form: "quote",
        name: get("name"),
        company: get("company") || undefined,
        phone: get("phone"),
        email: get("email"),
        message: get("message"),
        consent: true, // проверено выше: без галочки сюда не доходим
        trap: get("trap") || undefined,
      },
      idempotencyKey.current,
    );

    setStatus(result.ok ? "sent" : "failed");
    setNotice(result.message);
    if (result.ok) idempotencyKey.current = newIdempotencyKey();
  }

  if (status === "sent") {
    return (
      <div className={styles.card}>
        <p className={styles.pending} role="status" data-anim="rise">
          {notice}
        </p>
      </div>
    );
  }

  return (
    <form className={styles.card} onSubmit={onSubmit} noValidate>
      <div className={styles.row}>
        <div className={styles.field}>
          <input
            className={`${styles.input} ${errors.name ? styles.invalid : ""}`}
            name="name"
            placeholder="Имя"
            aria-label="Имя"
            autoComplete="name"
            aria-invalid={!!errors.name}
            aria-required="true"
            aria-describedby={errors.name ? "home-name-error" : undefined}
          />
          {errors.name && <span id="home-name-error" className={styles.error}>{errors.name}</span>}
        </div>
        <div className={styles.field}>
          <input
            className={styles.input}
            name="company"
            placeholder="Организация"
            aria-label="Организация"
            autoComplete="organization"
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <input
            className={`${styles.input} ${errors.phone ? styles.invalid : ""}`}
            name="phone"
            type="tel"
            placeholder="Телефон"
            aria-label="Телефон"
            autoComplete="tel"
            aria-invalid={!!errors.phone}
            aria-required="true"
            aria-describedby={errors.phone ? "home-phone-error" : undefined}
          />
          {errors.phone && <span id="home-phone-error" className={styles.error}>{errors.phone}</span>}
        </div>
        <div className={styles.field}>
          <input
            className={`${styles.input} ${errors.email ? styles.invalid : ""}`}
            name="email"
            type="email"
            placeholder="Рабочая почта"
            aria-label="Рабочая почта"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-required="true"
            aria-describedby={errors.email ? "home-email-error" : undefined}
          />
          {errors.email && <span id="home-email-error" className={styles.error}>{errors.email}</span>}
        </div>
      </div>

      <textarea
        className={`${styles.textarea} ${errors.message ? styles.invalid : ""}`}
        name="message"
        placeholder="Задача отделения, модель или вопрос"
        aria-label="Сообщение"
        aria-invalid={!!errors.message}
        aria-required="true"
        aria-describedby={errors.message ? "home-message-error" : undefined}
      />
      {errors.message && <span id="home-message-error" className={styles.error}>{errors.message}</span>}

      {/* Ловушка для ботов: человек этого поля не видит и не заполняет. */}
      <input
        type="text"
        name="trap"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className={styles.trap}
      />

      <label className={styles.consent}>
        <input
          type="checkbox"
          name="consent"
          aria-invalid={!!errors.consent}
          aria-required="true"
          aria-describedby={errors.consent ? "home-consent-error" : undefined}
        />
        {/* Та же правка, что в LeadForm: звёздочка вплотную к тексту,
            разделитель с воздухом. Формулировка согласия одна на обе формы,
            и вид у неё тоже должен быть один. */}
        <span>
          {consentCopy.label}
          <span className={styles.required}>*</span>
          <span className={styles.consentSep}>·</span>
          <Link href={consentCopy.href}>{consentCopy.linkLabel}</Link>
        </span>
      </label>
      {errors.consent && <span id="home-consent-error" className={styles.error}>{errors.consent}</span>}

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.submit}
          data-analytics="quote_form_submit"
          disabled={status === "sending"}
        >
          {status === "sending" ? "Отправляем…" : "Отправить запрос"}
        </button>
        <span className={styles.note}>{consentCopy.note}</span>
      </div>

      {status === "failed" && (
        <p className={styles.pending} role="alert" data-anim="rise">
          {notice} Позвоните{" "}
          <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a> или напишите на{" "}
          <a href={`mailto:${site.email}`}>{site.email}</a>.
        </p>
      )}
    </form>
  );
}
