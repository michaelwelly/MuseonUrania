"use client";

import { useState } from "react";
import { audit, type AuditEntry, type Page } from "@/lib/admin";
import { Note, useLoad, when } from "../ui";

// Журнал только читается. Двери на правку нет и быть не может: на уровне базы
// UPDATE и DELETE по audit_entry закрыты триггером, а настоящая защита —
// отзыв прав у роли приложения при развёртывании среды.

const SUBJECTS = ["", "product", "news", "document", "lead", "category", "media"];

export default function AuditPage() {
  const [subject, setSubject] = useState("");
  const [actor, setActor] = useState("");
  const [page, setPage] = useState(0);

  const { data, error, loading } = useLoad<Page<AuditEntry>>(
    () => audit({ subject, actor }, page),
    [subject, actor, page],
  );

  return (
    <>
      <div className="admin-head">
        <h1>Журнал</h1>
        <div className="row">
          <select
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setPage(0);
            }}
            style={select}
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s || "все объекты"}
              </option>
            ))}
          </select>
          <input
            placeholder="исполнитель"
            value={actor}
            onChange={(e) => {
              setActor(e.target.value);
              setPage(0);
            }}
            style={select}
          />
        </div>
      </div>
      <p className="admin-hint">
        Каждое действие в портале оставляет здесь запись. Персональных данных в журнале нет:
        пишутся идентификаторы, а не имена и адреса — иначе система логов сама становится
        хранилищем персональных данных.
      </p>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}

      {data && (
        <>
          <div className="admin-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Кто</th>
                  <th>Действие</th>
                  <th>Объект</th>
                  <th>Подробности</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td className="tight muted">{when(row.at)}</td>
                    <td className="tight">{row.actor}</td>
                    <td className="tight">
                      <span className="badge">{row.action}</span>
                    </td>
                    <td>
                      {row.subject}
                      {row.subjectId && <div className="mono">{row.subjectId}</div>}
                    </td>
                    <td>
                      {row.payload && <div className="mono">{row.payload}</div>}
                      {row.ip && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {row.ip}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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

const select: React.CSSProperties = {
  font: "inherit",
  fontSize: 14,
  padding: "8px 10px",
  border: "1px solid var(--line-3)",
  borderRadius: 8,
  background: "#fff",
};
