"use client";

import Link from "next/link";
import { useState } from "react";
import { quoteStatuses, quotes, type Page, type QuoteRow } from "@/lib/admin";
import { QUOTE_STATUS, label } from "../labels";
import { Note, day, money, useLoad, when } from "../ui";

// Коммерческие предложения по всем сделкам сразу. Заводятся они на карточке
// сделки — КП без сделки не бывает, и заводить его отсюда значило бы сначала
// спросить, к чему оно относится.

export default function QuotesPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);

  const { data: statuses } = useLoad<string[]>(quoteStatuses);
  const { data, error, loading } = useLoad<Page<QuoteRow>>(
    () => quotes(status, page),
    `${status}:${page}`,
  );

  return (
    <>
      <div className="admin-head">
        <h1>Коммерческие предложения</h1>
        <select
          className="admin-select"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">все статусы</option>
          {(statuses ?? []).map((s) => (
            <option key={s} value={s}>
              {label(QUOTE_STATUS, s)}
            </option>
          ))}
        </select>
      </div>
      <p className="admin-hint">
        Правится только черновик. Отправленное КП уже лежит у клиента в почте, и правка задним
        числом означала бы, что портал и клиент держат разные версии одного предложения.
        Нужны другие условия — заводится новое КП со своим номером.
      </p>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}
      {data?.items.length === 0 && <p className="admin-hint">КП с таким фильтром нет.</p>}

      {data && data.items.length > 0 && (
        <>
          <div className="admin-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Сделка</th>
                  <th>Статус</th>
                  <th>Сумма</th>
                  <th>Действует до</th>
                  <th>Отправлено</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td className="tight">
                      <Link href={`/admin/quotes/${row.id}/`}>{row.number}</Link>
                    </td>
                    <td>
                      <Link href={`/admin/deals/${row.dealId}/`}>{row.dealTitle}</Link>
                    </td>
                    <td className="tight">
                      <span className={`badge ${row.status === "accepted" ? "badge--on" : ""}`}>
                        {label(QUOTE_STATUS, row.status)}
                      </span>
                    </td>
                    <td className="tight">{money(row.total, row.currency)}</td>
                    <td className="tight">{day(row.validUntil)}</td>
                    <td className="tight muted">{when(row.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.pages > 1 && (
            <div className="row" style={{ marginTop: "var(--s4)" }}>
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
