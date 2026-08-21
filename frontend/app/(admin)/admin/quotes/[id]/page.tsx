"use client";

import Link from "next/link";
import { use, useState } from "react";
import {
  decideQuote,
  quote as loadQuote,
  sendQuote,
  updateQuote,
  type Quote,
  type QuoteForm,
  type QuoteItemForm,
} from "@/lib/admin";
import { QUOTE_STATUS, label } from "../../labels";
import { Field, Note, day, fieldErrors, isConflict, message, money, useLoad, when } from "../../ui";

// Карточка КП.
//
// Правится только черновик — это правило портала, и интерфейс его показывает,
// а не обходит: у отправленного КП формы здесь просто нет. Цену называет
// человек, и наружу — на сайт, в каталог, в ответы Ведалины — она не попадает.

const DECISIONS: Array<{ value: string; label: string }> = [
  { value: "accepted", label: "Клиент принял" },
  { value: "rejected", label: "Клиент отказался" },
  { value: "expired", label: "Срок истёк" },
];

export default function QuoteCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, reload, setError } = useLoad<Quote>(() => loadQuote(id), id);

  return (
    <>
      <div className="admin-head">
        <h1>КП {data?.number ?? ""}</h1>
        {data && (
          <div className="row">
            <span className={`badge ${data.status === "accepted" ? "badge--on" : ""}`}>
              {label(QUOTE_STATUS, data.status)}
            </span>
            <span className="mono">версия {data.version}</span>
          </div>
        )}
      </div>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}

      {data && (
        <>
          <p className="admin-hint">
            Сделка: <Link href={`/admin/deals/${data.dealId}/`}>{data.dealTitle}</Link>
            {data.sentAt && ` · отправлено ${when(data.sentAt)}`}
            {data.decidedAt && ` · решение ${when(data.decidedAt)}`}
          </p>

          {data.status === "draft" ? (
            <Draft key={data.id} quote={data} onSaved={reload} onError={setError} />
          ) : (
            <Settled quote={data} onDecided={reload} onError={setError} />
          )}
        </>
      )}
    </>
  );
}

function Draft({
  quote,
  onSaved,
  onError,
}: {
  quote: Quote;
  onSaved: () => void;
  onError: (message: string | null) => void;
}) {
  const [form, setForm] = useState<QuoteForm>({
    version: quote.version,
    currency: quote.currency,
    validUntil: quote.validUntil,
    note: quote.note ?? "",
    items: quote.items.map((i) => ({
      productSlug: i.productSlug ?? "",
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const set = <K extends keyof QuoteForm>(key: K, value: QuoteForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const patch = (index: number, next: Partial<QuoteItemForm>) =>
    set(
      "items",
      form.items.map((item, i) => (i === index ? { ...item, ...next } : item)),
    );

  // Предварительная сумма: настоящую считает портал и присылает в ответе.
  // Показывается она ради того, чтобы опечатка в цене была видна до
  // сохранения, а не после отправки клиенту.
  const preview = form.items.reduce((sum, i) => sum + (i.quantity || 0) * (i.unitPrice || 0), 0);

  async function save() {
    setSaving(true);
    setErrors({});
    setFailure(null);
    setConflict(false);
    try {
      const saved = await updateQuote(quote.id, form);
      setForm((f) => ({ ...f, version: saved.version }));
      onSaved();
    } catch (e) {
      setErrors(fieldErrors(e));
      if (isConflict(e)) setConflict(true);
      setFailure(message(e));
    } finally {
      setSaving(false);
    }
  }

  async function send() {
    setSending(true);
    onError(null);
    setFailure(null);
    try {
      await sendQuote(quote.id);
      onSaved();
    } catch (e) {
      setFailure(message(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {conflict ? (
        <Note kind="error">
          {failure} КП успел поправить кто-то ещё. Перечитайте карточку и внесите правку заново.{" "}
          <button className="btn btn--small" onClick={() => window.location.reload()}>
            Перечитать
          </button>
        </Note>
      ) : (
        <Note kind="error">{failure}</Note>
      )}

      <div className="admin-card">
        <div className="grid2">
          <Field label="Валюта" error={errors.currency} hint="Три заглавные буквы.">
            <input value={form.currency} onChange={(e) => set("currency", e.target.value)} />
          </Field>

          <Field
            label="Действует до"
            error={errors.validUntil}
            hint="Срок «до вчера» портал не примет при отправке."
          >
            <input
              type="date"
              value={form.validUntil ?? ""}
              onChange={(e) => set("validUntil", e.target.value || null)}
            />
          </Field>
        </div>

        <Field label="Примечание" error={errors.note}>
          <textarea value={form.note} onChange={(e) => set("note", e.target.value)} />
        </Field>
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">Позиции</h2>
        <p className="admin-hint" style={{ marginBottom: "var(--s3)" }}>
          Наименование хранится своё, а не берётся из каталога по ссылке: переименование
          изделия не должно задним числом менять уже отправленное предложение.
        </p>

        {form.items.map((item, i) => (
          <div key={i} className="quote-item">
            <input
              placeholder="Наименование"
              value={item.name}
              onChange={(e) => patch(i, { name: e.target.value })}
            />
            <input
              placeholder="Изделие"
              value={item.productSlug}
              onChange={(e) => patch(i, { productSlug: e.target.value })}
            />
            <input
              type="number"
              placeholder="Кол-во"
              value={item.quantity}
              onChange={(e) => patch(i, { quantity: Number(e.target.value) })}
            />
            <input
              type="number"
              placeholder="Цена"
              value={item.unitPrice}
              onChange={(e) => patch(i, { unitPrice: Number(e.target.value) })}
            />
            <span className="quote-item__sum">
              {money(item.quantity * item.unitPrice, form.currency)}
            </span>
            <button
              className="btn btn--small btn--danger"
              onClick={() =>
                set(
                  "items",
                  form.items.filter((_, index) => index !== i),
                )
              }
            >
              Удалить
            </button>
          </div>
        ))}

        {errors.items && <p className="note note--error">{errors.items}</p>}

        <div className="row" style={{ marginTop: "var(--s3)" }}>
          <button
            className="btn btn--small"
            onClick={() =>
              set("items", [
                ...form.items,
                { productSlug: "", name: "", quantity: 1, unitPrice: 0 },
              ])
            }
          >
            Добавить позицию
          </button>
          <span className="muted">
            предварительно {money(preview, form.currency)} — сумму считает портал
          </span>
        </div>
      </div>

      <div className="row row--end">
        <button
          className="btn"
          disabled={saving || conflict}
          onClick={() => void save()}
        >
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
        <button
          className="btn btn--primary"
          disabled={sending || quote.items.length === 0}
          title={
            quote.items.length === 0
              ? "Сначала сохраните хотя бы одну позицию: отправлять пустое КП нечего."
              : undefined
          }
          onClick={() => void send()}
        >
          {sending ? "Отмечаем…" : "Отметить отправленным"}
        </button>
      </div>

      <p className="admin-hint" style={{ marginTop: "var(--s3)" }}>
        Письмо портал пока не шлёт: `MailSender` пишет в лог, SMTP Яндекс 360 — следующий шаг.
        Отметка фиксирует, что предложение ушло, и с этого момента КП не правится.
      </p>
    </>
  );
}

function Settled({
  quote,
  onDecided,
  onError,
}: {
  quote: Quote;
  onDecided: () => void;
  onError: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function decide(status: string) {
    setBusy(true);
    onError(null);
    try {
      await decideQuote(quote.id, status);
      onDecided();
    } catch (e) {
      onError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="admin-card">
        <div className="admin-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Позиция</th>
                <th>Изделие</th>
                <th>Кол-во</th>
                <th>Цена</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item, i) => (
                <tr key={i}>
                  <td>{item.name}</td>
                  <td className="tight mono">{item.productSlug ?? "—"}</td>
                  <td className="tight">{item.quantity}</td>
                  <td className="tight">{money(item.unitPrice, quote.currency)}</td>
                  <td className="tight">{money(item.amount, quote.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="row row--end" style={{ marginTop: "var(--s4)", fontSize: "var(--t-base)" }}>
          Итого: <strong>{money(quote.total, quote.currency)}</strong>
        </p>
        <p className="muted" style={{ fontSize: "var(--t-small)" }}>
          Действует до {day(quote.validUntil)}
          {quote.note && ` · ${quote.note}`}
        </p>
      </div>

      {quote.status === "sent" && (
        <div className="admin-card">
          <h2 className="admin-card__title">Решение клиента</h2>
          <p className="admin-hint" style={{ marginBottom: "var(--s4)" }}>
            Отмечается только по отправленному: клиент не может согласиться с тем, чего
            не получал.
          </p>
          <div className="row">
            {DECISIONS.map((d) => (
              <button
                key={d.value}
                className={`btn ${d.value === "accepted" ? "btn--primary" : ""}`}
                disabled={busy}
                onClick={() => void decide(d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
