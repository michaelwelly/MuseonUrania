"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import {
  attachToDeal,
  createQuote,
  deal as loadDeal,
  dealQuotes,
  detachFromDeal,
  documents as loadDocuments,
  moveDeal,
  updateDeal,
  type Deal,
  type DealForm,
  type DocumentRow,
  type QuoteRow,
} from "@/lib/admin";
import History from "../../History";
import OwnerField from "../../OwnerField";
import { PIPELINE, QUOTE_STATUS as QS, STAGE, label } from "../../labels";
import { Field, Note, day, fieldErrors, isConflict, message, money, useLoad, when } from "../../ui";

// Карточка сделки: правка, перевод по воронке, вложения, КП и история.
//
// Перевод стадии сделан отдельным действием, а не полем формы, потому что
// это и есть отдельное действие: правка опечатки в названии не должна
// заодно закрывать сделку.

export default function DealCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, reload, setError } = useLoad<Deal>(() => loadDeal(id), id);

  return (
    <>
      <div className="admin-head">
        <h1>{data?.title ?? "Сделка"}</h1>
        {data && (
          <div className="row">
            <span className="badge">{label(PIPELINE, data.pipeline)}</span>
            <span className="badge badge--on">{label(STAGE, data.stage)}</span>
            <span className="mono">версия {data.version}</span>
          </div>
        )}
      </div>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}

      {data && (
        <>
          <p className="admin-hint">
            Клиент: <Link href={`/admin/clients/${data.clientId}/`}>{data.clientName}</Link>
            {data.leadId && " · заведена разбором заявки"}
            {data.closedAt && ` · закрыта ${when(data.closedAt)}`}
            {data.lostReason && ` · причина: ${data.lostReason}`}
          </p>

          <DealFields key={data.id} deal={data} onSaved={reload} />
          <StageBlock deal={data} onMoved={reload} onError={setError} />
          <Attachments deal={data} onChanged={reload} onError={setError} />
          <Quotes deal={data} onError={setError} />
          <History of="deals" id={data.id} />
        </>
      )}
    </>
  );
}

function DealFields({ deal, onSaved }: { deal: Deal; onSaved: () => void }) {
  const [form, setForm] = useState<DealForm>({
    version: deal.version,
    title: deal.title,
    amount: deal.amount,
    currency: deal.currency,
    productSlug: deal.productSlug ?? "",
    owner: deal.owner ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof DealForm>(key: K, value: DealForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setSaving(true);
    setErrors({});
    setFailure(null);
    setConflict(false);
    try {
      const saved = await updateDeal(deal.id, form);
      // Версию берём из ответа: без этого второе сохранение подряд получит
      // 409 на ровном месте.
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

  return (
    <div className="admin-card">
      <h2 className="admin-card__title">Карточка</h2>

      {conflict ? (
        <Note kind="error">
          {failure} Сделку успел поправить кто-то ещё. Перечитайте карточку и внесите правку
          заново.{" "}
          <button className="btn btn--small" onClick={() => window.location.reload()}>
            Перечитать
          </button>
        </Note>
      ) : (
        <Note kind="error">{failure}</Note>
      )}

      <Field label="Название" error={errors.title}>
        <input value={form.title} onChange={(e) => set("title", e.target.value)} />
      </Field>

      <div className="grid2">
        <Field label="Сумма" error={errors.amount} hint="Пусто — сумма ещё не названа.">
          <input
            type="number"
            value={form.amount ?? ""}
            onChange={(e) => set("amount", e.target.value === "" ? null : Number(e.target.value))}
          />
        </Field>

        <Field label="Валюта" error={errors.currency}>
          <input value={form.currency} onChange={(e) => set("currency", e.target.value)} />
        </Field>

        <Field label="Изделие" error={errors.productSlug}>
          <input value={form.productSlug} onChange={(e) => set("productSlug", e.target.value)} />
        </Field>

        <OwnerField value={form.owner} onChange={(login) => set("owner", login)} />
      </div>

      <div className="row row--end">
        <button
          className="btn btn--primary"
          disabled={saving || conflict}
          onClick={() => void save()}
        >
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}

function StageBlock({
  deal,
  onMoved,
  onError,
}: {
  deal: Deal;
  onMoved: () => void;
  onError: (message: string | null) => void;
}) {
  const [stage, setStage] = useState(deal.stage);
  const [reason, setReason] = useState(deal.lostReason ?? "");
  const [moving, setMoving] = useState(false);

  // Какая стадия проигрышная — правило домена, и приезжает оно в карточке.
  // Свой список здесь показывал бы поле причины по догадке и разъехался бы
  // с порталом молча: отказ-то придёт, но уже после нажатия.
  const losing = deal.lostStages.includes(stage);

  async function move() {
    setMoving(true);
    onError(null);
    try {
      await moveDeal(deal.id, stage, losing ? reason : null);
      onMoved();
    } catch (e) {
      onError(message(e));
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="admin-card">
      <h2 className="admin-card__title">Стадия</h2>
      <p className="admin-hint" style={{ marginBottom: "var(--s4)" }}>
        Стадия обязана быть из воронки этой сделки — набор приходит с карточкой. Воронка
        без причин проигрыша показывает, сколько потеряли, и молчит о том, почему.
      </p>

      <div className="grid2">
        <Field label="Стадия">
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            {deal.stages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        {losing && (
          <Field label="Причина проигрыша" hint="Обязательна: без неё портал не переведёт.">
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}
      </div>

      <div className="row row--end">
        <button
          className="btn"
          disabled={moving || stage === deal.stage || (losing && !reason.trim())}
          onClick={() => void move()}
        >
          {moving ? "Переводим…" : "Перевести"}
        </button>
      </div>
    </div>
  );
}

function Attachments({
  deal,
  onChanged,
  onError,
}: {
  deal: Deal;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const { data: all } = useLoad<DocumentRow[]>(loadDocuments);
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);

  const attached = new Set(deal.attachments.map((a) => a.documentId));
  // К сделке прикладываются только согласованные документы: несогласованный,
  // уехавший клиенту в КП, отзывается уже только письмом с извинениями.
  // Портал откажет и так — здесь несогласованных просто нет в выборе.
  const offered = (all ?? []).filter((d) => d.published && !attached.has(d.id));

  async function run(action: Promise<unknown>) {
    setBusy(true);
    onError(null);
    try {
      await action;
      setChosen("");
      onChanged();
    } catch (e) {
      onError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-card">
      <h2 className="admin-card__title">Вложения</h2>
      <p className="admin-hint" style={{ marginBottom: "var(--s4)" }}>
        Прикладывается ссылка на карточку документа, а не копия файла: копия разошлась бы
        с оригиналом при замене ревизии.
      </p>

      {deal.attachments.length === 0 && <p className="admin-hint">Документов не приложено.</p>}

      {deal.attachments.length > 0 && (
        <div className="admin-scroll">
          <table className="admin-table" style={{ marginBottom: "var(--s4)" }}>
            <thead>
              <tr>
                <th>Документ</th>
                <th>Приложил</th>
                <th>Когда</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {deal.attachments.map((a) => (
                <tr key={a.documentId}>
                  <td>
                    {a.title}
                    <div className="mono">{a.slug}</div>
                  </td>
                  <td className="tight">{a.attachedBy}</td>
                  <td className="tight muted">{when(a.attachedAt)}</td>
                  <td className="tight">
                    <button
                      className="btn btn--small btn--danger"
                      disabled={busy}
                      onClick={() => void run(detachFromDeal(deal.id, a.documentId))}
                    >
                      Отцепить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="row">
        <select
          className="admin-select"
          value={chosen}
          onChange={(e) => setChosen(e.target.value)}
        >
          <option value="">выберите согласованный документ</option>
          {offered.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        <button
          className="btn"
          disabled={busy || !chosen}
          onClick={() => void run(attachToDeal(deal.id, chosen))}
        >
          Приложить
        </button>
      </div>

      {all && offered.length === 0 && (
        <p className="admin-hint" style={{ marginTop: "var(--s3)" }}>
          Согласованных документов, ещё не приложенных к этой сделке, нет.
        </p>
      )}
    </div>
  );
}

function Quotes({ deal, onError }: { deal: Deal; onError: (message: string | null) => void }) {
  const router = useRouter();
  const { data, reload } = useLoad<QuoteRow[]>(() => dealQuotes(deal.id), deal.id);
  const [creating, setCreating] = useState(false);

  async function create() {
    setCreating(true);
    onError(null);
    try {
      // Черновик заводится пустым: номер выдаёт последовательность базы,
      // а позиции редактор набирает уже на карточке КП.
      const quote = await createQuote({
        dealId: deal.id,
        currency: deal.currency,
        validUntil: null,
        note: "",
        items: [],
      });
      reload();
      router.push(`/admin/quotes/${quote.id}/`);
    } catch (e) {
      onError(message(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="admin-card">
      <div className="admin-card__head">
        <h2 className="admin-card__title">Коммерческие предложения</h2>
        <button className="btn btn--small" disabled={creating} onClick={() => void create()}>
          {creating ? "Заводим…" : "Завести КП"}
        </button>
      </div>

      {data?.length === 0 && <p className="admin-hint">По этой сделке КП ещё не заводили.</p>}

      {data && data.length > 0 && (
        <div className="admin-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Статус</th>
                <th>Сумма</th>
                <th>Действует до</th>
                <th>Отправлено</th>
              </tr>
            </thead>
            <tbody>
              {data.map((q) => (
                <tr key={q.id}>
                  <td>
                    <Link href={`/admin/quotes/${q.id}/`}>{q.number}</Link>
                  </td>
                  <td className="tight">
                    <span className="badge">{label(QS, q.status)}</span>
                  </td>
                  <td className="tight">{money(q.total, q.currency)}</td>
                  <td className="tight">{day(q.validUntil)}</td>
                  <td className="tight muted">{when(q.sentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
