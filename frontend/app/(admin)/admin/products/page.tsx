"use client";

import Link from "next/link";
import { useState } from "react";
import { products, publishProduct, type ProductRow } from "@/lib/admin";
import { Empty, message, Note, Published, useLoad, when } from "../ui";

export default function ProductsPage() {
  const { data, error, loading, reload, setError } = useLoad<ProductRow[]>(products);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(row: ProductRow) {
    setBusy(row.id);
    try {
      await publishProduct(row.id, !row.published);
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
        <h1>Продукция</h1>
        <Link className="btn btn--primary" href="/admin/products/new/">
          Завести изделие
        </Link>
      </div>
      <p className="admin-hint">
        Здесь видно всё, включая черновики: публичный каталог показывает только опубликованное.
        Переименовать опубликованное изделие нельзя — адрес карточки уже разослан
        и проиндексирован; сначала снимите с публикации.
      </p>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}

      {data?.length === 0 && <Empty>Изделий пока нет. Каталог наполняется здесь — на сайт уходит только опубликованное.</Empty>}

      {data && data.length > 0 && (
        <div className="admin-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Изделие</th>
                <th>Категории</th>
                <th>Данные</th>
                <th>Состояние</th>
                <th>Правка</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/admin/products/${row.id}/`}>{row.name}</Link>
                    <div className="mono">{row.slug}</div>
                  </td>
                  <td>{row.categories.join(", ") || <span className="muted">—</span>}</td>
                  <td className="tight">
                    <span className={`badge ${row.docStatus === "confirmed" ? "" : "badge--warn"}`}>
                      {row.docStatus === "confirmed" ? "по датащиту" : "ожидает уточнения"}
                    </span>
                  </td>
                  <td className="tight">
                    <Published on={row.published} />
                  </td>
                  <td className="tight muted">{when(row.updatedAt)}</td>
                  <td className="tight">
                    <button
                      className="btn btn--small"
                      disabled={busy === row.id}
                      onClick={() => void toggle(row)}
                    >
                      {row.published ? "Снять" : "Опубликовать"}
                    </button>
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
