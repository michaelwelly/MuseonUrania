"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  clients as loadClients,
  convertLead,
  lead,
  leadStatuses,
  leads,
  pipelines as loadPipelines,
  triageLead,
  type ClientRow,
  type Conversion,
  type Lead,
  type LeadRow,
  type Page,
  type Pipeline,
} from "@/lib/admin";
import History from "../History";
import { Field, Note, message, useLoad, when } from "../ui";

// Единственная страница админки, где на экране персональные данные.
// Отсюда и размер страницы с потолком на портале: ?size=1000000 не должен
// превращать список в выгрузку всей базы одним запросом.

const STATUS_LABEL: Record<string, string> = {
  draft: "черновик",
  new: "новая",
  in_progress: "в работе",
  won: "выиграна",
  lost: "проиграна",
};

export default function LeadsPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const { data: statuses } = useLoad<string[]>(leadStatuses);
  const { data, error, loading, reload, setError } = useLoad<Page<LeadRow>>(
    () => leads(status, page),
    `${status}:${page}`,
  );

  return (
    <>
      <div className="admin-head">
        <h1>Заявки</h1>
        <div className="row">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
            style={{ font: "inherit", fontSize: 14, padding: "8px 10px",
              border: "1px solid var(--line-3)", borderRadius: 8, background: "#fff" }}
          >
            <option value="">все статусы</option>
            {(statuses ?? []).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="admin-pd">На экране персональные данные</p>
      <p className="admin-hint">
        Заявка приходит черновиком: доступа к закрытым данным у неё нет, статус поднимает
        менеджер. Смена статуса попадает в журнал без персональных данных — только
        идентификатор заявки и что с ней сделали.
      </p>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}
      {data?.items.length === 0 && <p className="admin-hint">Заявок с таким фильтром нет.</p>}

      {data && data.items.length > 0 && (
        <>
          <div className="admin-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Кто</th>
                  <th>Контакты</th>
                  <th>Форма</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td className="tight muted">{when(row.createdAt)}</td>
                    <td>
                      {row.name}
                      {row.company && <div className="muted" style={{ fontSize: 12 }}>{row.company}</div>}
                    </td>
                    <td>
                      <div className="mono">{row.phone}</div>
                      <div className="mono">{row.email}</div>
                    </td>
                    <td className="tight">
                      <span className="badge">{row.form}</span>
                      {row.productSlug && <div className="mono">{row.productSlug}</div>}
                    </td>
                    <td className="tight">
                      <span className={`badge ${row.status === "draft" ? "badge--warn" : ""}`}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                      {row.owner && (
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {row.owner}
                        </div>
                      )}
                    </td>
                    <td className="tight">
                      <button
                        className="btn btn--small"
                        onClick={() => setOpen(open === row.id ? null : row.id)}
                      >
                        {open === row.id ? "Свернуть" : "Разобрать"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {open && (
            <LeadCard
              // key по заявке обязателен: без него выбранный, но не сохранённый
              // статус переезжает на следующую открытую заявку, и «Сохранить
              // разбор» ставит его чужому обращению.
              key={open}
              id={open}
              statuses={statuses ?? []}
              onDone={() => {
                setOpen(null);
                reload();
              }}
              onError={setError}
            />
          )}

          {data.pages > 1 && (
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn btn--small" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Назад
              </button>
              <span className="muted">
                страница {data.page + 1} из {data.pages}, всего {data.total}
              </span>
              <button
                className="btn btn--small"
                disabled={page + 1 >= data.pages}
                onClick={() => setPage(page + 1)}
              >
                Дальше
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function LeadCard({
  id,
  statuses,
  onDone,
  onError,
}: {
  id: string;
  statuses: string[];
  onDone: () => void;
  onError: (message: string | null) => void;
}) {
  const { data, error, loading } = useLoad<Lead>(() => lead(id), id);
  const [status, setStatus] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!data) return;
    setSaving(true);
    onError(null);
    try {
      await triageLead(id, status ?? data.status, owner ?? data.owner);
      onDone();
    } catch (e) {
      onError(message(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-card" style={{ marginTop: 16 }}>
      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}

      {data && (
        <>
          <h2 style={{ fontSize: 15, marginBottom: 10 }}>
            {data.name}
            {data.company ? `, ${data.company}` : ""}
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 14, whiteSpace: "pre-wrap" }}>
            {data.message}
          </p>

          <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
            Источник: {data.source} · согласие версии {data.consentVersion} от{" "}
            {when(data.consentAt)}
            {data.correlationId && (
              <>
                {" · "}
                <span className="mono">{data.correlationId}</span>
              </>
            )}
          </p>

          <div className="grid2">
            <Field label="Статус">
              <select
                value={status ?? data.status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s] ?? s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ответственный" hint="Пусто — снять ответственного.">
              <input
                value={owner ?? data.owner ?? ""}
                onChange={(e) => setOwner(e.target.value)}
              />
            </Field>
          </div>

          <div className="row row--end">
            <button className="btn btn--primary" disabled={saving} onClick={() => void save()}>
              {saving ? "Сохраняем…" : "Сохранить разбор"}
            </button>
          </div>

          <ConvertToDeal lead={data} onError={onError} />
        </>
      )}

      <History of="leads" id={id} />
    </div>
  );
}

// Разбор заявки в сделку.
//
// Клиент либо указывается существующий, либо заводится из данных заявки.
// Портал не ищет совпадения сам: слить две карточки потом можно, разделить
// ошибочно слитые — уже нет. Заявка разбирается в сделку один раз — это
// ограничение схемы, и повторная попытка вернётся отказом.
function ConvertToDeal({
  lead: source,
  onError,
}: {
  lead: Lead;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const { data: funnels } = useLoad<Pipeline[]>(loadPipelines);

  const [existing, setExisting] = useState(false);
  const [typed, setTyped] = useState(source.company ?? source.name);
  const [query, setQuery] = useState("");
  const { data: found } = useLoad<Page<ClientRow>>(
    () => (query ? loadClients(query, 0, 20) : Promise.resolve(empty())),
    query,
  );

  const [form, setForm] = useState<Conversion>({
    clientId: null,
    pipeline: "sales",
    title: null,
    amount: null,
    owner: source.owner ?? "",
  });
  const [converting, setConverting] = useState(false);

  const set = <K extends keyof Conversion>(key: K, value: Conversion[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function convert() {
    setConverting(true);
    onError(null);
    try {
      const deal = await convertLead(source.id, {
        ...form,
        clientId: existing ? form.clientId : null,
      });
      router.push(`/admin/deals/${deal.id}/`);
    } catch (e) {
      onError(message(e));
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="convert">
      <h3 className="admin-card__title">Разобрать в сделку</h3>
      <p className="admin-hint" style={{ marginBottom: 14 }}>
        Заявка разбирается в сделку один раз — это ограничение схемы, а не проверка формы.
        Вместе со сделкой заводится карточка клиента, если не выбран существующий.
      </p>

      <div className="grid2">
        <Field label="Воронка">
          <select value={form.pipeline} onChange={(e) => set("pipeline", e.target.value)}>
            {(funnels ?? []).map((f) => (
              <option key={f.pipeline} value={f.pipeline}>
                {f.pipeline}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Ответственный">
          <input value={form.owner} onChange={(e) => set("owner", e.target.value)} />
        </Field>
      </div>

      <label className="field--row" style={{ marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={existing}
          onChange={(e) => {
            setExisting(e.target.checked);
            if (!e.target.checked) set("clientId", null);
          }}
        />
        <span style={{ fontSize: 13 }}>Клиент уже заведён — выбрать из базы</span>
      </label>

      {existing && (
        <>
          <div className="row" style={{ marginBottom: 10 }}>
            <input
              className="admin-search"
              value={typed}
              placeholder="Наименование или ИНН"
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setQuery(typed.trim())}
            />
            <button className="btn" onClick={() => setQuery(typed.trim())}>
              Найти
            </button>
          </div>

          {found && found.items.length > 0 && (
            <div className="picker">
              {found.items.map((c) => (
                <label key={c.id} className="picker__row">
                  <input
                    type="radio"
                    name={`client-${source.id}`}
                    checked={form.clientId === c.id}
                    onChange={() => set("clientId", c.id)}
                  />
                  <span>
                    {c.name}
                    {c.inn && <span className="mono"> · {c.inn}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}

          {query && found?.items.length === 0 && (
            <p className="admin-hint">
              По этому запросу никого нет. Снимите галочку — карточка заведётся из заявки.
            </p>
          )}
        </>
      )}

      <div className="grid2">
        <Field label="Название сделки" hint="Пусто — портал соберёт из формы и изделия заявки.">
          <input
            value={form.title ?? ""}
            onChange={(e) => set("title", e.target.value || null)}
          />
        </Field>

        <Field label="Сумма" hint="Пусто — сумма ещё не названа.">
          <input
            type="number"
            value={form.amount ?? ""}
            onChange={(e) => set("amount", e.target.value === "" ? null : Number(e.target.value))}
          />
        </Field>
      </div>

      <div className="row row--end">
        <button
          className="btn btn--primary"
          disabled={converting || (existing && !form.clientId)}
          onClick={() => void convert()}
        >
          {converting ? "Заводим…" : "Завести сделку"}
        </button>
      </div>
    </div>
  );
}

function empty(): Page<ClientRow> {
  return { items: [], page: 0, size: 0, total: 0, pages: 0 };
}
