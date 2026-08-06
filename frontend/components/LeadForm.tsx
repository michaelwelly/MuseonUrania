"use client";

import { useState } from "react";
import { serviceForm } from "@/content/service";
import { products } from "@/content/products";
import { site } from "@/content/site";
import styles from "./LeadForm.module.css";

type Errors = Partial<Record<"name" | "phone" | "email" | "message" | "consent", string>>;

// Проверка полей до отправки — валидация на границе доверия нужна независимо
// от того, куда запрос уйдёт потом.
export function validate(data: FormData): Errors {
  const errors: Errors = {};
  const get = (k: string) => String(data.get(k) ?? "").trim();

  if (!get("name")) errors.name = "Укажите, к кому обращаться";
  if (get("phone").replace(/\D/g, "").length < 10) errors.phone = "Укажите телефон с кодом";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get("email"))) errors.email = "Проверьте адрес почты";
  if (get("message").length < 10) errors.message = "Опишите обращение хотя бы одной фразой";
  if (!data.get("consent")) errors.consent = "Без согласия отправить запрос нельзя";

  return errors;
}

type Props = {
  /** Список тем обращения. Если не передан, селектор темы не показывается. */
  topics?: readonly string[];
  analytics: string;
  submitLabel?: string;
  hint?: string;
  messageLabel?: string;
};

export default function LeadForm({ topics, analytics, submitLabel, hint, messageLabel }: Props) {
  const [errors, setErrors] = useState<Errors>({});
  const [tried, setTried] = useState(false);

  // ponytail: отправлять некуда — CRM и Integration Gateway из
  // docs/architecture/vedal_portal_owner_brief.md ещё не построены.
  // Показываем рабочие контакты вместо ложного «спасибо, отправлено».
  // Заменить на POST в API, когда появится бэкенд.
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors(validate(new FormData(event.currentTarget)));
    setTried(true);
  }

  // Показываем только после реальной попытки отправки, а не при заполнении полей.
  const showPending = tried && Object.keys(errors).length === 0;

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      {topics && (
        <div className={`${styles.field} ${styles.fieldWide}`} style={{ marginTop: 0 }}>
          <label className={styles.label} htmlFor="topic">
            Тема обращения
          </label>
          <select id="topic" name="topic" className={styles.select} defaultValue={topics[0]}>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.row} style={topics ? { marginTop: 18 } : undefined}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="name">
            {serviceForm.fields.name} <span className={styles.required}>*</span>
          </label>
          <input
            id="name"
            name="name"
            className={`${styles.input} ${errors.name ? styles.invalid : ""}`}
            autoComplete="name"
            aria-invalid={!!errors.name}
          />
          {errors.name && <span className={styles.error}>{errors.name}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="company">
            {serviceForm.fields.company}
          </label>
          <input
            id="company"
            name="company"
            className={styles.input}
            autoComplete="organization"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="phone">
            {serviceForm.fields.phone} <span className={styles.required}>*</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className={`${styles.input} ${errors.phone ? styles.invalid : ""}`}
            autoComplete="tel"
            aria-invalid={!!errors.phone}
          />
          {errors.phone && <span className={styles.error}>{errors.phone}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">
            {serviceForm.fields.email} <span className={styles.required}>*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className={`${styles.input} ${errors.email ? styles.invalid : ""}`}
            autoComplete="email"
            aria-invalid={!!errors.email}
          />
          {errors.email && <span className={styles.error}>{errors.email}</span>}
        </div>
      </div>

      <div className={`${styles.field} ${styles.fieldWide}`}>
        <label className={styles.label} htmlFor="product">
          {serviceForm.fields.product}
        </label>
        <select id="product" name="product" className={styles.select} defaultValue="">
          <option value="">{serviceForm.productOther}</option>
          {products.map((p) => (
            <option key={p.slug} value={p.name}>
              {p.name} — {p.kind}
            </option>
          ))}
        </select>
      </div>

      <div className={`${styles.field} ${styles.fieldWide}`}>
        <label className={styles.label} htmlFor="message">
          {messageLabel ?? serviceForm.fields.message} <span className={styles.required}>*</span>
        </label>
        <textarea
          id="message"
          name="message"
          className={`${styles.textarea} ${errors.message ? styles.invalid : ""}`}
          aria-invalid={!!errors.message}
        />
        {errors.message && <span className={styles.error}>{errors.message}</span>}
      </div>

      <label className={styles.consent}>
        <input type="checkbox" name="consent" />
        <span>
          {serviceForm.consent} <span className={styles.required}>*</span>
        </span>
      </label>
      {errors.consent && <span className={styles.error}>{errors.consent}</span>}
      <p className={styles.consentNote}>{serviceForm.consentNote}</p>

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} data-analytics={analytics}>
          {submitLabel ?? serviceForm.submit}
        </button>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>

      {showPending && (
        <p className={styles.pending} role="status" data-anim="rise">
          Отправка заявок подключается вместе с CRM. Пока напишите на{" "}
          <a href={`mailto:${site.email}`}>{site.email}</a> или позвоните{" "}
          <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a> — запрос примет
          специалист.
        </p>
      )}
    </form>
  );
}
