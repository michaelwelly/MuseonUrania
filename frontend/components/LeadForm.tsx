"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { consent as consentCopy } from "@/content/legal";
import { site } from "@/content/site";
import { ui, type UiStrings } from "@/content/ui";
import { contentText } from "@/lib/content-i18n";
import { DEFAULT_LANG, localePath, type Lang } from "@/lib/i18n";
import {
  attribution,
  newIdempotencyKey,
  submitLead,
  type LeadForm as FormType,
} from "@/lib/submit";
import { reachGoal } from "@/lib/analytics";
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
//
// Тексты ошибок приходят вторым аргументом, а не берутся из словаря внутри:
// проверка не должна знать про язык страницы, она знает про поля. Умолчание
// русское — так функция остаётся вызываемой одним аргументом и из тестов,
// и из мест, где языка нет.
export function validate(data: FormData, messages: UiStrings["form"]["errors"] = ui(DEFAULT_LANG).form.errors): Errors {
  const errors: Errors = {};
  const get = (k: string) => String(data.get(k) ?? "").trim();

  if (!get("name")) errors.name = messages.name;
  if (get("phone").replace(/\D/g, "").length < 10) errors.phone = messages.phone;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get("email"))) errors.email = messages.email;
  // Единственная проверка серийного номера — длина, и та же стоит на бэкенде.
  // Формат не проверяется: вид номера VEDAL в согласованных материалах
  // не описан, а маска, придуманная здесь, отклоняла бы настоящие номера.
  if (get("serialNumber").length > 100) {
    errors.serialNumber = messages.serialNumber;
  }
  if (get("message").length < 10) errors.message = messages.message;
  if (!data.get("consent")) errors.consent = messages.consent;

  return errors;
}

export type Topic = { code: FormType; label: string };

/** Позиция каталога: то, чем связывается заявка с изделием. */
export type ProductRef = { slug: string; name: string; kind: string };

type Props = {
  /** Тип заявки. Если передан список тем, его перекрывает выбор пользователя. */
  form: FormType;
  /** Темы обращения. Если не переданы, селектор темы не показывается. */
  topics?: readonly Topic[];
  /**
   * Изделие, по которому оставляют заявку. Задано страницей — карточкой
   * изделия, — поэтому селектор не показывается вовсе: человек уже выбрал
   * изделие тем, что дошёл до его страницы, и второй выбор того же самого
   * это выбор, который можно сделать неправильно.
   *
   * Перекрывает {@link Props.products}: там, где изделие известно, список
   * каталога не нужен.
   */
  product?: ProductRef;
  /** Позиции каталога для селектора изделия. Приходят с бэкенда через страницу. */
  products?: readonly ProductRef[];
  analytics: string;
  /** Язык страницы. Русский по умолчанию — форму строят и тесты без пропа. */
  lang?: Lang;
  submitLabel?: string;
  hint?: string;
  messageLabel?: string;
};

export default function LeadForm({
  form,
  topics,
  product,
  products = [],
  analytics,
  lang = DEFAULT_LANG,
  submitLabel,
  hint,
  messageLabel,
}: Props) {
  const strings = ui(lang);
  const c = contentText(lang);
  // Ответ портала всегда по-русски: тексты живут на бэкенде. Помечаем их
  // языком, а не выдаём за язык страницы.
  const noticeLang = lang === DEFAULT_LANG ? undefined : "ru";
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

    const found = validate(data, strings.form.errors);
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
      // Цель — на принятой заявке, а не на нажатии кнопки. Клик по «Отправить»
      // с пустым телефоном или при упавшем бэкенде отправкой формы не является,
      // и посчитанный как отправка он завышал бы конверсию ровно на те случаи,
      // ради которых её и смотрят.
      //
      // Есть селектор темы — цель идёт за темой. Форма на /contacts/ отправляет
      // и запрос цены, и запрос каталога, и сервисное обращение; посчитанные
      // одной целью, они дают одно число, из которого не видно, чего просили.
      // Имена совпадают со списком из чек-листа приёмки: `quote_form_submit`,
      // `catalog_form_submit`, `service_form_submit`.
      reachGoal(topics ? `${topic}_form_submit` : analytics);
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
        <p className={styles.pending} role="status" data-anim="rise" lang={noticeLang}>
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
            {strings.form.again}
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
            {strings.form.topic}
          </label>
          <select
            id="topic"
            name="topic"
            className={styles.select}
            value={topic}
            onChange={(event) => setTopic(event.target.value as FormType)}
          >
            {/* Названия тем приходят из content/contacts.ts — это содержание,
                а не подпись поля: тема определяет, куда уедет заявка. */}
            {topics.map((t) => (
              <option key={t.code} value={t.code} lang={c.mark(t.label)}>
                {c.t(t.label)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={`${styles.row} ${topics ? styles.rowSpaced : ""}`}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="name">
            {strings.form.name} <span className={styles.required}>*</span>
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
            {strings.form.company}
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
            {strings.form.phone} <span className={styles.required}>*</span>
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
            {strings.form.email} <span className={styles.required}>*</span>
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

      {/* Изделие известно странице — показываем его, а не спрашиваем.
          Скрытое поле названо так же, как селектор ниже: отправка читает
          `product` из FormData и про разницу между «выбрали» и «пришли
          с карточки» знать не обязана.

          Название изделия не переводится ни на одном языке — это имя
          позиции каталога, а не подпись интерфейса; направление (`kind`)
          идёт через `c.t`, как и везде. */}
      {product ? (
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <p className={styles.label}>{strings.form.product}</p>
          <p className={styles.fixed} lang={c.mark(product.kind)}>
            {product.name} — {c.t(product.kind)}
          </p>
          <input type="hidden" name="product" value={product.slug} />
        </div>
      ) : products.length === 0 ? null : (
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label className={styles.label} htmlFor="product">
            {strings.form.product}
          </label>
          {/* Значение — slug, а не название: бэкенд связывает заявку с позицией
              каталога по нему. Название в базе может смениться, slug — нет. */}
          <select id="product" name="product" className={styles.select} defaultValue="">
            <option value="">{strings.form.productOther}</option>
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
            {strings.form.serialNumber}
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
              {strings.form.serialHint}
            </span>
          )}
        </div>
      )}

      <div className={`${styles.field} ${styles.fieldWide}`}>
        <label className={styles.label} htmlFor="message">
          {messageLabel ?? strings.form.message} <span className={styles.required}>*</span>
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
        {/* Текст согласия мы не переводим: бэкенд хранит версию формулировки,
            под которой человек подписался, и перевод — это другая
            формулировка. До согласования показываем русскую и помечаем её. */}
        <span lang={c.mark(consentCopy.label, consentCopy.linkLabel)}>
          {c.t(consentCopy.label)}
          <span className={styles.required}>*</span>
          <span className={styles.consentSep}>·</span>
          <Link href={localePath(lang, consentCopy.href)}>{c.t(consentCopy.linkLabel)}</Link>
        </span>
      </label>
      {errors.consent && <span id="consent-error" className={styles.error}>{errors.consent}</span>}
      <p className={styles.consentNote} lang={c.mark(consentCopy.note)}>
        {c.t(consentCopy.note)}
      </p>

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.submit}
          disabled={sending}
        >
          {sending ? strings.form.sending : (submitLabel ?? strings.form.submit)}
        </button>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>

      {status === "failed" && (
        <p className={styles.pending} role="alert" data-anim="rise">
          <span lang={noticeLang}>{notice}</span> {strings.form.fallbackCall}{" "}
          <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>{" "}
          {strings.form.fallbackWrite} <a href={`mailto:${site.email}`}>{site.email}</a>
          {strings.form.fallbackEnd}
        </p>
      )}
    </form>
  );
}
