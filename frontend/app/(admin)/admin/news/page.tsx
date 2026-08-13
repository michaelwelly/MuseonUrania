"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteNews, news, publishNews, type NewsRow } from "@/lib/admin";
import { Note, Published, message, useLoad, when } from "../ui";

export default function NewsPage() {
  const { data, error, loading, reload, setError } = useLoad<NewsRow[]>(news);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: () => Promise<unknown>) {
    setBusy(id);
    setError(null);
    try {
      await action();
      reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Новости</h1>
        <Link className="btn btn--primary" href="/admin/news/new/">
          Написать материал
        </Link>
      </div>
      <p className="admin-hint">
        Дата в ленте и видимость — разные вещи: материал готовят заранее и публикуют позже.
        Без даты опубликовать нельзя, это ограничение схемы, а не пожелание.
      </p>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}
      {data?.length === 0 && (
        <p className="admin-hint">
          Пока пусто. Демонстрационные публикации из макета в базу не переносились —
          это прямое указание в HANDOFF.md.
        </p>
      )}

      {data && data.length > 0 && (
        <div className="admin-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Заголовок</th>
                <th>Рубрика</th>
                <th>Дата в ленте</th>
                <th>Состояние</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/admin/news/${row.id}/`}>{row.title}</Link>
                    <div className="mono">{row.slug}</div>
                  </td>
                  <td className="tight">
                    <span className="badge">{row.tag}</span>
                  </td>
                  <td className="tight muted">{row.publishedOn ?? "—"}</td>
                  <td className="tight">
                    <Published on={row.published} />
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {when(row.updatedAt)}
                    </div>
                  </td>
                  <td className="tight">
                    <div className="row">
                      <button
                        className="btn btn--small"
                        disabled={busy === row.id}
                        onClick={() => void act(row.id, () => publishNews(row.id, !row.published))}
                      >
                        {row.published ? "Снять" : "Опубликовать"}
                      </button>
                      <button
                        className="btn btn--small btn--danger"
                        disabled={busy === row.id || row.published}
                        title={
                          row.published
                            ? "Сначала снимите с публикации: живая ссылка из рассылки не должна перестать открываться одним нажатием"
                            : undefined
                        }
                        onClick={() => void act(row.id, () => deleteNews(row.id))}
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
