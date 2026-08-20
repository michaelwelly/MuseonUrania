"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { serviceForm } from "@/content/service";
import { consent as consentCopy } from "@/content/legal";
import { site } from "@/content/site";
import {
  attribution,
  newIdempotencyKey,
  submitLead,
  type LeadForm as FormType,
} from "@/lib/submit";
import styles from "./LeadForm.module.css";

type Errors = Partial<Record<"name" | "phone" | "email" | "message" | "consent", string>>;

// Проверка полей до отправки — валидация на границе доверия нужна независимо
// от того, куда запрос уйдёт потом. Те же правила стоят в LeadSubmission
// на бэкенде: браузеру верить нельзя, а пользователю нужно показать ошибку
// сразу, не гоняя запрос.
export function validate(data: FormData): Errors {
  const errors: Errors = {};
  const get = (k: string) => String(data.get(k) ?? "").trim();

  if (!get("name")) errors.name = "Укажите, к кому обращаться";
  if (get("phone").replace(/\D/g, "").length < 10) errors.phone = "Укажите телефон с кодом";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get("email"))) errors.email = "Проверьте адрес почты";
  if (get("message").length < 10) errors.message = "Опишите обращение хотя бы одной фразой";
  if (!data.get("consent")) errors.consent = consentCopy.error;

  return errors;
}

/** Поля бэкенда, у которых на этой форме есть свой ярлык под инпутом. */
const FIELD_ERRORS = new Set(["name", "phone", "email", "message", "consent"]);

export type Topic = { code: FormType; label: string };

type Props = {
  /** Тип заявки. Если передан список тем, его перекрывает выбор пользователя. */
  form: FormType;
  /** Темы обращения. Если не переданы, селектор темы не показывается. */
  topics?: readonly Topic[];
  /** Позиции каталога для селектора изделия. Приходят с бэкенда через страницу. */
  products?: readonly { slug: string; name: string; kind: string }[];
  analytics: string;
  submitLabel?: string;
  hint?: string;
  messageLabel?: string;
};

export default function LeadForm({
  form,
  topics,
  products = [],
  analytics,
  submitLabel,
  hint,
  messageLabel,
}: Props) {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [notice, setNotice] = useState("");

  // Ключ живёт столько же, сколько заполняемая форма: повторный клик по
  // «Отправить» не создаст вторую заявку. После успешной отправки берём новый —
  // следующее обращение с той же страницы должно быть отдельной заявкой.
  const idempotencyKey = useRef(newIdempotencyKey());

  // Атрибуция снимается один раз, при монтировании формы, а не в момент
  // отправки. Посетитель приходит по ссылке с меткой кампании, ходит по сайту
  // и отправляет заявку уже с другого адреса — прочитать метку при отправке
  // значит потерять её у всех, кто не заполнил форму на первой же странице.
  const attributed = useRef<{ language?: string; campaign?: string }>({});
  useEffect(() => {
    attributed.current = attribution(window.location.search, document.documentElement.lang);
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    const found = validate(data);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setStatus("sending");
    setNotice("");

    const get = (k: string) => String(data.get(k) ?? "").trim();
    const result = await submitLead(
      {
        form: (get("topic") || form) as FormType,
        name: get("name"),
        company: get("company") || undefined,
        phone: get("phone"),
        email: get("email"),
        productSlug: get("product") || undefined,
        message: get("message"),
        consent: data.get("consent") !== null,
        language: attributed.current.language,
        campaign: attributed.current.campaign,
        trap: get("trap") || undefined,
      },
      idempotencyKey.current,
    );

    if (result.ok) {
      setStatus("sent");
      setNotice(result.message);
      idempotencyKey.current = newIdempotencyKey();
      return;
    }

    // Бэкенд разбирает ошибку по полям — показываем их рядом с полями,
    // а не одной строкой над формой.
    if (result.fields) {
      const mapped: Errors = {};
      for (const [field, message] of Object.entries(result.fields)) {
        if (FIELD_ERRORS.has(field)) mapped[field as keyof Errors] = message;
      }
      setErrors(mapped);
    }
    setStatus("failed");
    setNotice(result.message);
  }

  const sending = status === "sending";

  // Успешная отправка убирает форму: повторно слать то же обращение незачем.
  if (status === "sent") {
    return (
      <div className={styles.form}>
        <p className={styles.pending} role="status" data-anim="rise">
          {notice}
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.submit}
            onClick={() => {
              setStatus("idle");
              setNotice("");
            }}
          >
            Отправить ещё одно обращение
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      {topics && (
        <div className={`${styles.field} ${styles.fieldWide}`} style={{ marginTop: 0 }}>
          <label className={styles.label} htmlFor="topic">
            Тема обращения
          </label>
          <select id="topic" name="topic" className={styles.select} defaultValue={topics[0].code}>
            {topics.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
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

      {products.length > 0 && (
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label className={styles.label} htmlFor="product">
            {serviceForm.fields.product}
          </label>
          {/* Значение — slug, а не название: бэкенд связывает заявку с позицией
              каталога по нему. Название в базе может смениться, slug — нет. */}
          <select id="product" name="product" className={styles.select} defaultValue="">
            <option value="">{serviceForm.productOther}</option>
            {products.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name} — {p.kind}
              </option>
            ))}
          </select>
        </div>
      )}

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

      {/* Ловушка для ботов. Скрыта от человека и от скринридера, автозаполнение
          выключено: браузер не должен подставить сюда значение сам. */}
      <input
        type="text"
        name="trap"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className={styles.trap}
      />

      {/* §14.6: рядом с согласием стоит ссылка на политику — иначе человек
          подписывается под документом, которого не видел. */}
      <label className={styles.consent}>
        <input type="checkbox" name="consent" aria-invalid={!!errors.consent} />
        <span>
          {consentCopy.label} <span className={styles.required}>*</span>
          {" · "}
          <Link href={consentCopy.href}>{consentCopy.linkLabel}</Link>
        </span>
      </label>
      {errors.consent && <span className={styles.error}>{errors.consent}</span>}
      <p className={styles.consentNote}>{consentCopy.note}</p>

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.submit}
          data-analytics={analytics}
          disabled={sending}
        >
          {sending ? "Отправляем…" : (submitLabel ?? serviceForm.submit)}
        </button>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>

      {status === "failed" && (
        <p className={styles.pending} role="alert" data-anim="rise">
          {notice} Можно написать на <a href={`mailto:${site.email}`}>{site.email}</a> или позвонить{" "}
          <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>.
        </p>
      )}
    </form>
  );
}
