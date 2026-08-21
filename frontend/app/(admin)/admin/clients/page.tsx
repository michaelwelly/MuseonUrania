"use client";

import Link from "next/link";
import { useState } from "react";
import { clients, type ClientRow, type Page } from "@/lib/admin";
import { Empty, Note, useLoad, when } from "../ui";

// Клиентская база. Вторая страница админки после заявок, где на экране
// персональные данные, — отсюда потолок размера страницы на портале.

export default function ClientsPage() {
  // Введённое и применённое разведены намеренно: с одним состоянием запрос
  // уходил бы на каждую нажатую букву, а поиск идёт по всей базе.
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const { data, error, loading } = useLoad<Page<ClientRow>>(
    () => clients(query, page),
    `${query}:${page}`,
  );

  function apply() {
    setQuery(typed.trim());
    setPage(0);
  }

  return (
    <>
      <div className="admin-head">
        <h1>Клиенты</h1>
        <Link className="btn btn--primary" href="/admin/clients/new/">
          Завести клиента
        </Link>
      </div>
      <p className="admin-pd">На экране персональные данные</p>
      <p className="admin-hint">
        Клиентская база не живёт в почте и не уезжает наружу: ни в публичное API, ни в топики,
        ни в письма. Вторая карточка с тем же ИНН развела бы историю одной организации
        по двум местам — портал такую не заведёт.
      </p>

      <div className="row" style={{ marginBottom: "var(--s4)" }}>
        <input
          className="admin-search"
          value={typed}
          placeholder="Наименование или ИНН"
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
        />
        <button className="btn" onClick={apply}>
          Найти
        </button>
        {query && (
          <button
            className="btn btn--small"
            onClick={() => {
              setTyped("");
              setQuery("");
              setPage(0);
            }}
          >
            Сбросить
          </button>
        )}
      </div>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}
      {data?.items.length === 0 && (
        <Empty>
          {query ? "По этому запросу никого нет." : "Клиентов пока нет."}
        </Empty>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="admin-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>ИНН</th>
                  <th>Город</th>
                  <th>Сделок</th>
                  <th>Ответственный</th>
                  <th>Изменён</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/clients/${row.id}/`}>{row.name}</Link>
                      <div className="muted" style={{ fontSize: "var(--t-small)" }}>
                        {row.kind === "company" ? "организация" : "человек"}
                      </div>
                    </td>
                    <td className="tight mono">{row.inn || "—"}</td>
                    <td className="tight">{row.city || "—"}</td>
                    <td className="tight">
                      {row.deals > 0 ? (
                        <Link href={`/admin/deals/?client=${row.id}`}>{row.deals}</Link>
                      ) : (
                        <span className="muted">0</span>
                      )}
                    </td>
                    <td className="tight">{row.owner || <span className="muted">—</span>}</td>
                    <td className="tight muted">{when(row.updatedAt)}</td>
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
