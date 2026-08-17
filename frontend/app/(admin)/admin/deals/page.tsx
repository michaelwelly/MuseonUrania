"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { deals, pipelines as loadPipelines, type DealRow, type Page, type Pipeline } from "@/lib/admin";
import { PIPELINE, STAGE, label } from "../labels";
import { Note, money, useLoad, when } from "../ui";

// Сделки всех трёх воронок в одном списке. Три таблицы здесь были бы тремя
// одинаковыми экранами: у сделок общая карточка, общий ответственный,
// общая история и общая аналитика — различается только набор стадий.

// useSearchParams требует границы Suspense: без неё страница, собранная
// заранее, падает на сборке, а не в браузере.
export default function DealsPage() {
  return (
    <Suspense fallback={<p className="muted">Загружаем…</p>}>
      <Deals />
    </Suspense>
  );
}

function Deals() {
  const clientId = useSearchParams().get("client") ?? "";
  const [pipeline, setPipeline] = useState("");
  const [stage, setStage] = useState("");
  const [page, setPage] = useState(0);

  const { data: funnels } = useLoad<Pipeline[]>(loadPipelines);
  const { data, error, loading } = useLoad<Page<DealRow>>(
    () => deals({ pipeline, stage, clientId }, page),
    `${pipeline}:${stage}:${clientId}:${page}`,
  );

  // Стадии рисуются только у выбранной воронки: набор у каждой свой,
  // и стадию из чужой не примет ни домен, ни схема.
  const stages = funnels?.find((f) => f.pipeline === pipeline)?.stages ?? [];

  return (
    <>
      <div className="admin-head">
        <h1>Сделки</h1>
        <Link className="btn btn--primary" href="/admin/deals/new/">
          Завести сделку
        </Link>
      </div>
      <p className="admin-hint">
        Суммы и условия — закрытый контур: наружу они не уходят ни в публичное API, ни в топики.
        Событие о сделке несёт идентификатор, воронку и стадию, но не имя клиента и не сумму.
      </p>

      {clientId && (
        <p className="admin-hint">
          Показаны сделки одного клиента. <Link href="/admin/deals/">Показать все</Link>
        </p>
      )}

      <div className="row" style={{ marginBottom: 16 }}>
        <select
          className="admin-select"
          value={pipeline}
          onChange={(e) => {
            setPipeline(e.target.value);
            // Стадия принадлежит воронке: оставить её при смене воронки
            // значит попросить портал о заведомо пустом списке.
            setStage("");
            setPage(0);
          }}
        >
          <option value="">все воронки</option>
          {(funnels ?? []).map((f) => (
            <option key={f.pipeline} value={f.pipeline}>
              {label(PIPELINE, f.pipeline)}
            </option>
          ))}
        </select>

        <select
          className="admin-select"
          value={stage}
          disabled={!pipeline}
          onChange={(e) => {
            setStage(e.target.value);
            setPage(0);
          }}
        >
          <option value="">все стадии</option>
          {stages.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}
      {data?.items.length === 0 && <p className="admin-hint">Сделок с таким фильтром нет.</p>}

      {data && data.items.length > 0 && (
        <>
          <div className="admin-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Сделка</th>
                  <th>Клиент</th>
                  <th>Воронка</th>
                  <th>Стадия</th>
                  <th>Сумма</th>
                  <th>Ответственный</th>
                  <th>Изменена</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/deals/${row.id}/`}>{row.title}</Link>
                      {row.productSlug && <div className="mono">{row.productSlug}</div>}
                    </td>
                    <td>
                      <Link href={`/admin/clients/${row.clientId}/`}>{row.clientName}</Link>
                    </td>
                    <td className="tight">
                      <span className="badge">{label(PIPELINE, row.pipeline)}</span>
                    </td>
                    <td className="tight">{label(STAGE, row.stage)}</td>
                    <td className="tight">{money(row.amount, row.currency)}</td>
                    <td className="tight">{row.owner || <span className="muted">—</span>}</td>
                    <td className="tight muted">{when(row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.pages > 1 && (
            <div className="row" style={{ marginTop: 16 }}>
              <button
                className="btn btn--small"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
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
