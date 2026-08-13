"use client";

import { useState } from "react";
import {
  categories,
  createCategory,
  deleteCategory,
  updateCategory,
  type Category,
} from "@/lib/admin";
import { Field, Note, message, useLoad } from "../ui";

export default function CategoriesPage() {
  const { data, error, loading, reload, setError } = useLoad<Category[]>(categories, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState({ slug: "", name: "", position: 0 });

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
        <h1>Категории</h1>
      </div>
      <p className="admin-hint">
        Категорию с изделиями удалить нельзя: на связке стоит ограничение внешнего ключа.
        Сначала переназначьте изделия.
      </p>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}

      {data && (
        <div className="admin-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Slug</th>
                <th>Порядок</th>
                <th>Изделий</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <Row key={row.id} row={row} busy={busy === row.id} act={act} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-card" style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Новая категория</h2>
        <div className="grid2">
          <Field label="Название">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Slug" hint="Латиница в нижнем регистре, цифры и дефис.">
            <input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
          </Field>
        </div>
        <Field label="Порядок">
          <input
            type="number"
            value={draft.position}
            onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) || 0 })}
          />
        </Field>
        <div className="row row--end">
          <button
            className="btn btn--primary"
            disabled={busy === "new" || !draft.slug || !draft.name}
            onClick={() =>
              void act("new", async () => {
                await createCategory(draft);
                setDraft({ slug: "", name: "", position: 0 });
              })
            }
          >
            Завести
          </button>
        </div>
      </div>
    </>
  );
}

function Row({
  row,
  busy,
  act,
}: {
  row: Category;
  busy: boolean;
  act: (id: string, action: () => Promise<unknown>) => Promise<void>;
}) {
  const [edit, setEdit] = useState(row);

  return (
    <tr>
      <td>
        <input
          value={edit.name}
          onChange={(e) => setEdit({ ...edit, name: e.target.value })}
          style={cell}
        />
      </td>
      <td>
        <input
          value={edit.slug}
          onChange={(e) => setEdit({ ...edit, slug: e.target.value })}
          style={cell}
        />
      </td>
      <td className="tight">
        <input
          type="number"
          value={edit.position}
          onChange={(e) => setEdit({ ...edit, position: Number(e.target.value) || 0 })}
          style={{ ...cell, width: 72 }}
        />
      </td>
      <td className="tight">{row.productCount}</td>
      <td className="tight">
        <div className="row">
          <button
            className="btn btn--small"
            disabled={busy}
            onClick={() =>
              void act(row.id, () =>
                updateCategory(row.id, {
                  slug: edit.slug,
                  name: edit.name,
                  position: edit.position,
                }),
              )
            }
          >
            Сохранить
          </button>
          <button
            className="btn btn--small btn--danger"
            disabled={busy || row.productCount > 0}
            title={row.productCount > 0 ? "В категории есть изделия" : undefined}
            onClick={() => void act(row.id, () => deleteCategory(row.id))}
          >
            Удалить
          </button>
        </div>
      </td>
    </tr>
  );
}

const cell: React.CSSProperties = {
  font: "inherit",
  fontSize: 14,
  padding: "6px 9px",
  border: "1px solid var(--line-3)",
  borderRadius: 7,
  width: "100%",
};
