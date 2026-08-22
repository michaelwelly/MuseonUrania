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

/**
 * Поля, у которых на этой форме есть свой ярлык ошибки под инпутом,
 * в порядке разметки.
 *
 * Один список на две задачи: по нему ищется первое поле с ошибкой для
 * переноса фокуса и по нему же отбираются ошибки, пришедшие с бэкенда.
 * Раньше это были два независимых литерала, и добавление поля требовало
 * вспомнить про оба. Забыть легко, а последствие тихое: промах фокуса
 * замечает только тот, кто ходит по форме с клавиатуры или со
 * скринридером, — то есть об ошибке никто не сообщит.
 *
 * Порядок здесь обязан совпадать с порядком полей в разметке: человек
 * должен попасть на первую ошибку сверху, а не на случайную.
 *
 * Организации и изделия здесь нет намеренно: ярлыка ошибки у них не
 * нарисовано, и ошибка по ним молча пропала бы. Такие ответы бэкенда
 * показывает общее сообщение под кнопкой.
 */
const FIELDS = ["name", "phone", "email", "serialNumber", "message", "consent"] as const;

type Field = (typeof FIELDS)[number];

type Errors = Partial<Record<Field, string>>;

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
  // Единственная проверка серийного номера — длина, и та же стоит на бэкенде.
  // Формат не проверяется: вид номера VEDAL в согласованных материалах
  // не описан, а маска, придуманная здесь, отклоняла бы настоящие номера.
  if (get("serialNumber").length > 100) {
    errors.serialNumber = "Серийный номер не длиннее 100 символов";
  }
  if (get("message").length < 10) errors.message = "Опишите обращение хотя бы одной фразой";
  if (!data.get("consent")) errors.consent = consentCopy.error;

  return errors;
}

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

  // Тема обращения держится в состоянии, а не только в значении селектора:
  // от неё зависит, показывать ли серийный номер. Неуправляемый select
  // о смене выбора не сообщает, и поле не появлялось бы вовсе.
  //
  // Тем нет — тему задаёт страница, и она не меняется.
  const [topic, setTopic] = useState<FormType>(topics ? topics[0].code : form);

  // Серийный номер спрашивается только в сервисном обращении: в запросе цены,
  // каталога или партнёрства изделия у человека ещё нет, и поле там — шум.
  const asksSerial = topic === "service";

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
    const formEl = event.currentTarget;
    const data = new FormData(formEl);

    const found = validate(data);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Фокус на первое поле с ошибкой. Без этого для незрячего посетителя
      // нажатие «Отправить» выглядит как «ничего не произошло»: сообщения
      // появляются рядом с полями, но ни фокус, ни живая область о них
      // не сообщают, и найти их можно, только заново обойдя всю форму.
      //
      // Порядок обхода — порядок полей в форме, а не порядок ключей объекта:
      // человек должен попасть на первую ошибку сверху, а не на случайную.
      const first = FIELDS.find((field) => found[field]);
      const control = first ? formEl.elements.namedItem(first) : null;
      if (control instanceof HTMLElement) control.focus();
      return;
    }

    setStatus("sending");
    setNotice("");

    const get = (k: string) => String(data.get(k) ?? "").trim();
    const result = await submitLead(
      {
        form: topic,
        name: get("name"),
        company: get("company") || undefined,
        phone: get("phone"),
        email: get("email"),
        productSlug: get("product") || undefined,
        // Поле снято с формы вместе со сменой темы: в FormData его нет,
        // и на бэкенд уедет undefined, а не номер от прошлого выбора.
        serialNumber: get("serialNumber") || undefined,
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
        if ((FIELDS as readonly string[]).includes(field)) mapped[field as Field] = message;
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
        <div className={`${styles.field} ${styles.fieldWide} ${styles.fieldFirst}`}>
          <label className={styles.label} htmlFor="topic">
            Тема обращения
          </label>
          <select
            id="topic"
            name="topic"
            className={styles.select}
            value={topic}
            onChange={(event) => setTopic(event.target.value as FormType)}
          >
            {topics.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={`${styles.row} ${topics ? styles.rowSpaced : ""}`}>
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
            aria-required="true"
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && <span id="name-error" className={styles.error}>{errors.name}</span>}
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
            aria-required="true"
            aria-describedby={errors.phone ? "phone-error" : undefined}
          />
          {errors.phone && <span id="phone-error" className={styles.error}>{errors.phone}</span>}
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
            aria-required="true"
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && <span id="email-error" className={styles.error}>{errors.email}</span>}
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

      {asksSerial && (
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label className={styles.label} htmlFor="serialNumber">
            {serviceForm.fields.serialNumber}
          </label>
          <input
            id="serialNumber"
            name="serialNumber"
            className={`${styles.input} ${errors.serialNumber ? styles.invalid : ""}`}
            /* Автозаполнение выключено: номера аппарата в профиле браузера нет,
               а подставленный им телефон или адрес уедет сервисному инженеру
               как серийный номер — это хуже пустого поля. */
            autoComplete="off"
            aria-invalid={!!errors.serialNumber}
            aria-describedby={errors.serialNumber ? "serial-error" : "serial-hint"}
          />
          {errors.serialNumber ? (
            <span id="serial-error" className={styles.error}>
              {errors.serialNumber}
            </span>
          ) : (
            <span id="serial-hint" className={styles.fieldHint}>
              {serviceForm.serialHint}
            </span>
          )}
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
          aria-required="true"
          aria-describedby={errors.message ? "message-error" : undefined}
        />
        {errors.message && <span id="message-error" className={styles.error}>{errors.message}</span>}
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
        <input
          type="checkbox"
          name="consent"
          aria-invalid={!!errors.consent}
          aria-required="true"
          aria-describedby={errors.consent ? "consent-error" : undefined}
        />
        {/* Звёздочка вплотную к тексту, разделитель с воздухом. Раньше между
            ними стояли два пробела подряд, и строка читалась как «данных * ·
            Политика» — набор знаков, а не подпись со ссылкой. */}
        <span>
          {consentCopy.label}
          <span className={styles.required}>*</span>
          <span className={styles.consentSep}>·</span>
          <Link href={consentCopy.href}>{consentCopy.linkLabel}</Link>
        </span>
      </label>
      {errors.consent && <span id="consent-error" className={styles.error}>{errors.consent}</span>}
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
