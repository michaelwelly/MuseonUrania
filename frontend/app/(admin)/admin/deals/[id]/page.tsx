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
import { plural } from "@/lib/plural";
import History from "../../History";
import OwnerField from "../../OwnerField";
import { useToast } from "../../Toast";
import { ArrowIcon } from "../../icons";
import { PIPELINE, QUOTE_STATUS as QS, STAGE, label } from "../../labels";
import {
  Empty,
  Field,
  Note,
  State,
  day,
  fieldErrors,
  isConflict,
  message,
  money,
  useLoad,
  when,
} from "../../ui";
import { Reason } from "../Reason";

// Карточка сделки.
//
// Сюда заходят двигать сделку, а не править её поля: название и сумму задают
// один раз, а стадию меняют по нескольку раз в неделю. Отсюда раскладка —
// полоса стадий стоит первой, сразу под заголовком, и переводит одним
// нажатием.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему полоса, а не выпадающий список
//
// Список отвечал на вопрос «какие бывают стадии», а вопрос был другой:
// «где мы сейчас и что дальше». Полоса отвечает на него, не открываясь,
// и заодно показывает то, чего список показать не мог, — сколько стадий
// позади и сколько впереди.
//
// Перевод остался отдельным действием, а не полем формы: правка опечатки
// в названии не должна заодно закрывать сделку.
//
// ───────────────────────────────────────────────────────────────────────────
// Чего полоса не показывает
//
// Дат перехода между стадиями. Портал их не хранит: в карточке есть время
// последней правки и время закрытия, а истории переходов нет. «Три дня
// в стадии», посчитанные из `updatedAt`, были бы неправдой на сделке,
// которую вчера правили, не двигая, — поэтому под текущей стадией стоит
// «без изменений N дней», и это ровно то, что портал знает.

export default function DealCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, reload, setError } = useLoad<Deal>(() => loadDeal(id), id);

  return (
    <>
      <div className="admin-head">
        <div className="deal__head">
          <h1>{data?.title ?? "Сделка"}</h1>
          {data && (
            <p className="deal__sub">
              <Link href={`/admin/clients/${data.clientId}/`}>{data.clientName}</Link>
              <span className="deal__sum mono">{money(data.amount, data.currency)}</span>
              <span className="muted">
                {data.owner ?? "ответственного нет"} · {label(PIPELINE, data.pipeline)}
              </span>
            </p>
          )}
        </div>
        {data && <Actions deal={data} onMoved={reload} onError={setError} />}
      </div>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}

      {data && (
        <>
          <Stages deal={data} onMoved={reload} onError={setError} />

          <div className="deal">
            <div className="deal__left">
              <DealFields key={data.id} deal={data} onSaved={reload} />
              <Quotes deal={data} onError={setError} />
              <Attachments deal={data} onChanged={reload} onError={setError} />
            </div>

            <div className="deal__right">
              <History of="deals" id={data.id} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Перевод по воронке

/** Куда «дальше». Отказные стадии пропускаются: в отказ уводят нарочно. */
function next(deal: Deal): string | null {
  const at = deal.stages.indexOf(deal.stage);
  if (at < 0) return null;
  return deal.stages.slice(at + 1).find((s) => !deal.lostStages.includes(s)) ?? null;
}

function Actions({
  deal,
  onMoved,
  onError,
}: {
  deal: Deal;
  onMoved: () => void;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const move = useMove(deal, onMoved, onError);
  const [creating, setCreating] = useState(false);

  const дальше = next(deal);
  const отказ = deal.lostStages[0];
  const закрыта = deal.wonStages.includes(deal.stage) || deal.lostStages.includes(deal.stage);

  async function quote() {
    setCreating(true);
    onError(null);
    try {
      // Черновик заводится пустым: номер выдаёт последовательность базы,
      // а позиции редактор набирает уже на карточке КП.
      const created = await createQuote({
        dealId: deal.id,
        currency: deal.currency,
        validUntil: null,
        note: "",
        items: [],
      });
      router.push(`/admin/quotes/${created.id}/`);
    } catch (e) {
      onError(message(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="row">
        <button className="btn" disabled={creating} onClick={() => void quote()}>
          {creating ? "Заводим…" : "Составить КП"}
        </button>

        {отказ && !закрыта && (
          <button className="btn btn--danger" onClick={() => move.ask(отказ)}>
            Отказ
          </button>
        )}

        {/* «квалифицирована →» на кнопке читалось как метка, а не как
            действие: непонятно, это фильтр, состояние или всё-таки кнопка.
            В дереве доступности было ещё хуже — кнопка с именем
            «квалифицирована» не говорит, что она делает. */}
        {дальше && (
          <button className="btn btn--primary" onClick={() => move.to(дальше)}>
            Дальше: {label(STAGE, дальше)}
            <ArrowIcon />
          </button>
        )}
      </div>

      {move.asking && (
        <Reason
          title={deal.title}
          stage={move.asking}
          onCancel={move.cancel}
          onDone={(reason) => move.to(move.asking!, reason)}
        />
      )}
    </>
  );
}

/**
 * Перевод стадии: сам запрос, вопрос о причине и отмена.
 *
 * Отдельным крючком, потому что переводят из двух мест — кнопкой в шапке
 * и щелчком по полосе, — и правило «в отказ только с причиной» должно быть
 * записано один раз.
 */
function useMove(deal: Deal, onMoved: () => void, onError: (message: string | null) => void) {
  const toast = useToast();
  const [asking, setAsking] = useState<string | null>(null);

  const to = async (stage: string, reason?: string) => {
    if (stage === deal.stage) return;
    if (deal.lostStages.includes(stage) && !reason) {
      setAsking(stage);
      return;
    }
    setAsking(null);
    onError(null);
    const было = deal.stage;
    try {
      await moveDeal(deal.id, stage, reason ?? null);
      onMoved();
      toast(`Стадия: ${label(STAGE, stage)}`, async () => {
        await moveDeal(deal.id, было, null);
        onMoved();
      });
    } catch (e) {
      onError(message(e));
    }
  };

  return {
    asking,
    ask: (stage: string) => setAsking(stage),
    cancel: () => setAsking(null),
    to: (stage: string, reason?: string) => void to(stage, reason),
  };
}

function Stages({
  deal,
  onMoved,
  onError,
}: {
  deal: Deal;
  onMoved: () => void;
  onError: (message: string | null) => void;
}) {
  const move = useMove(deal, onMoved, onError);
  const [now] = useState(() => Date.now());

  const at = deal.stages.indexOf(deal.stage);
  const отказом = deal.lostStages.includes(deal.stage);
  const дней = Math.floor((now - new Date(deal.updatedAt).valueOf()) / 86_400_000);

  return (
    <>
      <div className="stages" role="group" aria-label="Стадии сделки">
        {deal.stages.map((stage, i) => {
          const сейчас = stage === deal.stage;
          // Пройденной стадия считается только у сделки, идущей вперёд.
          // У проигранной «пройдено» означало бы, что до отказа дошли
          // все стадии, — а дошли ровно до той, где отказали.
          const пройдена = !отказом && i < at;
          const вид = сейчас
            ? отказом
              ? "stages__one--stop"
              : "stages__one--now"
            : пройдена
              ? "stages__one--past"
              : "stages__one--next";

          return (
            <button
              key={stage}
              type="button"
              className={`stages__one ${вид}`}
              aria-current={сейчас ? "step" : undefined}
              disabled={сейчас}
              onClick={() => move.to(stage)}
            >
              <span className="stages__name">{label(STAGE, stage)}</span>
              <span className="stages__note mono">{под(deal, stage, сейчас, дней)}</span>
            </button>
          );
        })}
      </div>

      <p className="admin-hint">
        Щелчок по стадии переводит сделку сразу — полоса внизу семь секунд держит отмену.
        Дат перехода портал не хранит, поэтому под текущей стадией стоит время последней
        правки карточки, а не время, проведённое в стадии.
      </p>

      {move.asking && (
        <Reason
          title={deal.title}
          stage={move.asking}
          onCancel={move.cancel}
          onDone={(reason) => move.to(move.asking!, reason)}
        />
      )}
    </>
  );
}

/** Моно-строка под названием стадии. Пусто — значит порталу сказать нечего. */
function под(deal: Deal, stage: string, сейчас: boolean, дней: number): string {
  if (!сейчас) return "";
  if (deal.lostStages.includes(stage)) {
    return deal.lostReason ? deal.lostReason : "причина не названа";
  }
  if (deal.wonStages.includes(stage) && deal.closedAt) return `закрыта ${day(deal.closedAt.slice(0, 10))}`;
  if (!Number.isFinite(дней) || дней < 1) return "правили сегодня";
  return `без изменений ${дней} ${plural(дней, "день", "дня", "дней")}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Поля карточки

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

// ───────────────────────────────────────────────────────────────────────────
// Вложения

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
      <p className="admin-hint">
        Прикладывается ссылка на карточку документа, а не копия файла: копия разошлась бы
        с оригиналом при замене ревизии.
      </p>

      {deal.attachments.length === 0 && <Empty>Документов не приложено.</Empty>}

      {deal.attachments.map((a) => (
        <div key={a.documentId} className="attach">
          <span className="attach__body">
            <span className="attach__name">{a.title}</span>
            <span className="attach__meta mono">
              {a.slug} · {a.attachedBy} · {when(a.attachedAt)}
            </span>
          </span>
          <button
            className="btn btn--small btn--danger"
            disabled={busy}
            onClick={() => void run(detachFromDeal(deal.id, a.documentId))}
          >
            Отцепить
          </button>
        </div>
      ))}

      <div className="row">
        <select
          aria-label="Согласованный документ для приложения"
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
        <p className="admin-hint">
          Согласованных документов, ещё не приложенных к этой сделке, нет.
        </p>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// КП по сделке

function Quotes({ deal, onError }: { deal: Deal; onError: (message: string | null) => void }) {
  const router = useRouter();
  const { data } = useLoad<QuoteRow[]>(() => dealQuotes(deal.id), deal.id);
  const [creating, setCreating] = useState(false);

  async function create() {
    setCreating(true);
    onError(null);
    try {
      const quote = await createQuote({
        dealId: deal.id,
        currency: deal.currency,
        validUntil: null,
        note: "",
        items: [],
      });
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

      {data?.length === 0 && <Empty>По этой сделке КП ещё не заводили.</Empty>}

      {data?.map((q) => (
        <Link key={q.id} className="quote-line" href={`/admin/quotes/${q.id}/`}>
          <span className="quote-line__no mono">{q.number}</span>
          <State value={q.status} dict={QS} />
          <span className="quote-line__till mono">до {day(q.validUntil)}</span>
          <span className="quote-line__sum mono">{money(q.total, q.currency)}</span>
        </Link>
      ))}
    </div>
  );
}
