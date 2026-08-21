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
import { useToast } from "../../Toast";
import { CloseIcon } from "../../icons";
import { QUOTE_STATUS } from "../../labels";
import {
  Field,
  Note,
  Segments,
  State,
  day,
  fieldErrors,
  isConflict,
  message,
  money,
  useLoad,
  when,
} from "../../ui";

// Карточка КП.
//
// Единственное место портала, где цену называет человек. Наружу — на сайт,
// в каталог, в ответы Ведалины — она не попадает ни при каких условиях:
// у публичного API цены нет как поля.
//
// Правится только черновик. Это правило портала, и интерфейс его показывает,
// а не обходит: у отправленного КП формы здесь просто нет.

const DECISIONS: Array<{ value: string; label: string }> = [
  { value: "accepted", label: "Клиент принял" },
  { value: "rejected", label: "Клиент отказался" },
  { value: "expired", label: "Срок истёк" },
];

/** Валюты, которыми пользуются. Чужая, если она уже стоит в КП, добавляется. */
const ВАЛЮТЫ = ["RUB", "USD", "EUR"];

export default function QuoteCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, reload, setError } = useLoad<Quote>(() => loadQuote(id), id);

  return (
    <>
      <div className="admin-head">
        <div className="deal__head">
          {/* Номер уже начинается с «КП-», и приставка давала «КП КП-2026-0001».
              Раздел и вкладка над заголовком и так говорят, что это КП. */}
          <h1>{data?.number ?? "Коммерческое предложение"}</h1>
          {data && (
            <p className="deal__sub">
              <Link href={`/admin/deals/${data.dealId}/`}>{data.dealTitle}</Link>
              <State value={data.status} dict={QUOTE_STATUS} />
              {data.sentAt && <span className="muted">отправлено {when(data.sentAt)}</span>}
              {data.decidedAt && <span className="muted">решение {when(data.decidedAt)}</span>}
            </p>
          )}
        </div>
      </div>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}

      {data &&
        (data.status === "draft" ? (
          <Draft key={data.id} quote={data} onSaved={reload} onError={setError} />
        ) : (
          <Settled quote={data} onDecided={reload} onError={setError} />
        ))}
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
  const toast = useToast();
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
  const итого = form.items.reduce((sum, i) => sum + (i.quantity || 0) * (i.unitPrice || 0), 0);
  const валюты = ВАЛЮТЫ.includes(form.currency) ? ВАЛЮТЫ : [form.currency, ...ВАЛЮТЫ];

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
      // Без отмены: отметка «отправлено» закрывает правку и уходит в журнал.
      // Полоса здесь сообщает, а не предлагает выбор.
      toast(`КП ${quote.number} отмечено отправленным`);
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
          {failure} КП успел поправить кто-то ещё. Перечитайте карточку и внесите правку
          заново.{" "}
          <button className="btn btn--small" onClick={() => window.location.reload()}>
            Перечитать
          </button>
        </Note>
      ) : (
        <Note kind="error">{failure}</Note>
      )}

      <div className="quote">
        <div className="quote__main">
          <div className="admin-scroll">
            <table className="admin-table quote__items">
              <thead>
                <tr>
                  <th>Что</th>
                  <th>Кол-во</th>
                  <th>Цена</th>
                  <th>Сумма</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        aria-label={`Наименование позиции ${i + 1}`}
                        placeholder="Наименование"
                        value={item.name}
                        onChange={(e) => patch(i, { name: e.target.value })}
                      />
                      {/* Изделие каталога — ссылкой, а наименование своё:
                          переименование изделия не должно задним числом
                          менять уже отправленное предложение. */}
                      <input
                        className="mono quote__slug"
                        aria-label={`Изделие позиции ${i + 1}`}
                        placeholder="без карточки"
                        value={item.productSlug}
                        onChange={(e) => patch(i, { productSlug: e.target.value })}
                      />
                    </td>
                    <td className="tight">
                      <input
                        className="mono num quote__qty"
                        aria-label={`Количество позиции ${i + 1}`}
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => patch(i, { quantity: Number(e.target.value) })}
                      />
                    </td>
                    <td className="tight">
                      <input
                        className="mono num quote__price"
                        aria-label={`Цена позиции ${i + 1}`}
                        type="number"
                        min={0}
                        value={item.unitPrice}
                        onChange={(e) => patch(i, { unitPrice: Number(e.target.value) })}
                      />
                    </td>
                    <td className="tight mono num quote__sum">
                      {money(item.quantity * item.unitPrice, form.currency)}
                    </td>
                    <td className="tight">
                      <button
                        type="button"
                        className="quote__drop"
                        aria-label={`Убрать позицию ${i + 1}`}
                        onClick={() =>
                          set(
                            "items",
                            form.items.filter((_, index) => index !== i),
                          )
                        }
                      >
                        <CloseIcon size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {errors.items && <p className="note note--error">{errors.items}</p>}

          <div className="row">
            <button
              type="button"
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
          </div>

          <div className="quote__total">
            <span className="quote__total-name">Итого</span>
            <span className="quote__total-sum mono">{money(итого, form.currency)}</span>
          </div>
          <p className="admin-hint">
            Сумма пересчитывается на ходу, чтобы опечатка в цене была видна до сохранения.
            Настоящую считает портал и присылает в ответе.
          </p>

          <Field
            label="Примечание для клиента"
            error={errors.note}
            hint="Сроки поставки не обещаем, пока их не подтвердило производство."
          >
            <textarea rows={3} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </Field>
        </div>

        <aside className="quote__side">
          <Field
            label="Действует до"
            error={errors.validUntil}
            hint="По истечении КП само перейдёт в «истекло». Срок «до вчера» портал не примет при отправке."
          >
            <input
              className="mono"
              type="date"
              value={form.validUntil ?? ""}
              onChange={(e) => set("validUntil", e.target.value || null)}
            />
          </Field>

          <div className="triage__field">
            <span className="triage__label">Валюта</span>
            <Segments
              label="Валюта КП"
              value={form.currency}
              options={валюты}
              onChange={(v) => set("currency", v)}
            />
            {errors.currency && <p className="note note--error">{errors.currency}</p>}
          </div>

          <div className="warn">
            <p className="warn__title">Отправленное КП не правится</p>
            <p className="warn__body">
              После отметки форма закроется. Нужны другие условия — заводится новое КП
              со своим номером, и в переписке с клиентом это будет видно.
            </p>
          </div>

          <div className="flat">
            <p className="flat__title">Цена наружу не уходит</p>
            <p className="flat__body">
              Ни на сайт, ни в топики, ни в ответы Ведалины: у публичного API цены нет
              как поля. В каталоге стоит «по запросу».
            </p>
          </div>
        </aside>
      </div>

      <div className="row row--end">
        <button type="button" className="btn" disabled={saving || conflict} onClick={() => void save()}>
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
        <button
          type="button"
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

      {/* Кнопка называет то, что случится. «Отправить клиенту» было бы
          неправдой: письма портал пока не шлёт — событие в топик уходит,
          а потребителя у него нет, и это упирается в SMTP Яндекс 360.
          Отметка фиксирует, что предложение ушло, и закрывает правку. */}
      <p className="admin-hint">
        Письма портал пока не отправляет: событие о КП уходит в топик, потребителя у него
        нет. Отметка фиксирует, что предложение ушло, и с этого момента КП не правится.
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
    <div className="quote">
      <div className="quote__main">
        <div className="admin-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Что</th>
                <th>Кол-во</th>
                <th>Цена</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item, i) => (
                <tr key={i}>
                  <td>
                    <span className="row__name">{item.name}</span>
                    <span className="row__under mono">{item.productSlug ?? "без карточки"}</span>
                  </td>
                  <td className="tight mono num">{item.quantity}</td>
                  <td className="tight mono num">{money(item.unitPrice, quote.currency)}</td>
                  <td className="tight mono num">{money(item.amount, quote.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="quote__total">
          <span className="quote__total-name">Итого</span>
          <span className="quote__total-sum mono">{money(quote.total, quote.currency)}</span>
        </div>

        {quote.note && <p className="triage__message">{quote.note}</p>}
      </div>

      <aside className="quote__side">
        <dl className="pairs">
          <div className="pairs__row">
            <dt>Действует до</dt>
            <dd className="mono">{day(quote.validUntil)}</dd>
          </div>
          <div className="pairs__row">
            <dt>Отправлено</dt>
            <dd className="mono">{quote.sentAt ? when(quote.sentAt) : "—"}</dd>
          </div>
          <div className="pairs__row">
            <dt>Решение</dt>
            <dd className="mono">{quote.decidedAt ? when(quote.decidedAt) : "ждём"}</dd>
          </div>
        </dl>

        {quote.status === "sent" && (
          <>
            <p className="triage__label">Решение клиента</p>
            <p className="triage__note">
              Отмечается только по отправленному: клиент не может согласиться с тем, чего
              не получал.
            </p>
            <div className="row">
              {DECISIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  className={`btn btn--small ${d.value === "accepted" ? "btn--primary" : ""}`}
                  disabled={busy}
                  onClick={() => void decide(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
