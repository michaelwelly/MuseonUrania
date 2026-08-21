"use client";

import { useState } from "react";
import {
  createDocument,
  documentVocabulary,
  documents,
  publishDocument,
  updateDocument,
  uploadDocumentFile,
  type DocumentForm,
  type DocumentRow,
  type Vocabulary,
} from "@/lib/admin";
import { Empty, Field, message, Note, Published, useLoad, when } from "../ui";

// Документы — единственное место админки, где правило доступа видно прямо
// в интерфейсе: строка знает, почему её нельзя опубликовать, и говорит это
// до нажатия. Те же три правила закрыты ограничениями схемы, так что обойти
// их правкой интерфейса нельзя.

const MAX_MB = 20;

export default function DocumentsPage() {
  const { data, error, loading, reload, setError } = useLoad<DocumentRow[]>(documents);
  const { data: vocabulary } = useLoad<Vocabulary>(documentVocabulary);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<DocumentRow | null>(null);
  const [creating, setCreating] = useState(false);

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

  async function upload(row: DocumentRow, file: File) {
    if (file.size > MAX_MB * 1024 * 1024) {
      // Проверяем и здесь, чтобы не гонять двадцать мегабайт впустую.
      // Настоящий предел стоит в разборе multipart на портале — этот
      // только бережёт время.
      setError(`Файл больше ${MAX_MB} МБ — портал его не примет.`);
      return;
    }
    await act(row.id, () => uploadDocumentFile(row.id, file));
  }

  return (
    <>
      <div className="admin-head">
        <h1>Документы</h1>
        <button className="btn btn--primary" onClick={() => setCreating(true)}>
          Завести документ
        </button>
      </div>
      <p className="admin-hint">
        Перечень и публикация — разные вещи. Строка в перечне видна на сайте вместе со
        статусом доступа, даже когда файла ещё нет; скачивается только опубликованное.
        Публично размещается только <code>public</code>: сервисные инструкции,
        конструкторская и производственная документация на сайт не выкладываются.
        Предел файла — {MAX_MB} МБ.
      </p>

      <Note kind="error">{error}</Note>

      {(creating || editing) && vocabulary && (
        <DocumentCard
          // key по документу обязателен. Без него React переиспользует ту же
          // позицию в дереве, useState не переинициализируется, и переход
          // с одного документа на другой оставляет в форме поля предыдущего —
          // а «Сохранить» пишет их под идентификатором нового.
          key={editing?.id ?? "new"}
          vocabulary={vocabulary}
          existing={editing ?? undefined}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            reload();
          }}
        />
      )}

      {loading && !data && <p className="muted">Загружаем…</p>}

      {data?.length === 0 && <Empty>Документов пока нет. Здесь заводятся карточки, а файл к ним прикладывается отдельно.</Empty>}

      {data && data.length > 0 && (
        <div className="admin-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Документ</th>
                <th>Раздел</th>
                <th>Доступ</th>
                <th>Файл</th>
                <th>Состояние</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button
                      className="btn btn--small"
                      style={{ border: "none", padding: 0, background: "none", color: "var(--green-dark)" }}
                      onClick={() => setEditing(row)}
                    >
                      {row.title}
                    </button>
                    <div className="mono">{row.slug}</div>
                    <div className="muted" style={{ fontSize: "var(--t-small)" }}>{row.subject}</div>
                  </td>
                  <td className="tight">{row.group}</td>
                  <td className="tight">
                    <span className={`badge ${row.sensitivity === "public" ? "" : "badge--warn"}`}>
                      {row.sensitivity}
                    </span>
                    <div style={{ marginTop: "var(--s1)" }}>
                      <span className="badge">{row.access}</span>
                    </div>
                  </td>
                  <td className="tight">
                    {row.hasFile ? (
                      <span className="badge badge--on">
                        {row.fileSize ? `${(row.fileSize / 1024 / 1024).toFixed(1)} МБ` : "есть"}
                      </span>
                    ) : (
                      <span className="badge badge--off">нет</span>
                    )}
                    <div style={{ marginTop: "var(--s2)" }}>
                      <input
                        aria-label="Файл документа"
                        type="file"
                        style={{ fontSize: "var(--t-small)", maxWidth: 190 }}
                        disabled={busy === row.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void upload(row, file);
                        }}
                      />
                    </div>
                  </td>
                  <td>
                    <Published on={row.published} />
                    {row.approvedBy && (
                      <div className="muted" style={{ fontSize: "var(--t-small)", marginTop: "var(--s1)" }}>
                        согласовал {row.approvedBy}
                      </div>
                    )}
                    <div className="muted" style={{ fontSize: "var(--t-small)", marginTop: "var(--s1)" }}>
                      {when(row.updatedAt)}
                    </div>
                    {row.publishBlockedBy && (
                      <div className="muted" style={{ fontSize: "var(--t-small)", marginTop: "var(--s2)", maxWidth: 280 }}>
                        {row.publishBlockedBy}
                      </div>
                    )}
                  </td>
                  <td className="tight">
                    <button
                      className="btn btn--small"
                      disabled={busy === row.id || (!row.published && row.publishBlockedBy !== null)}
                      title={row.publishBlockedBy ?? undefined}
                      onClick={() =>
                        void act(row.id, () => publishDocument(row.id, !row.published))
                      }
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

function DocumentCard({
  vocabulary,
  existing,
  onCancel,
  onSaved,
}: {
  vocabulary: Vocabulary;
  existing?: DocumentRow;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<DocumentForm>(
    existing
      ? {
          version: existing.version,
          slug: existing.slug,
          title: existing.title,
          group: existing.group,
          subject: existing.subject,
          productSlug: existing.productSlug,
          sensitivity: existing.sensitivity,
          access: existing.access,
          listed: existing.listed,
          revision: existing.revision,
          sourceOwner: null,
        }
      : {
          version: 0,
          slug: "",
          title: "",
          group: vocabulary.groups[0],
          subject: "",
          productSlug: null,
          sensitivity: "public",
          access: "pending",
          listed: true,
          revision: null,
          sourceOwner: null,
        },
  );
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof DocumentForm>(key: K, value: DocumentForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setSaving(true);
    setFailure(null);
    try {
      if (existing) await updateDocument(existing.id, form);
      else await createDocument(form);
      onSaved();
    } catch (e) {
      setFailure(message(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-card">
      <h2 style={{ fontSize: "var(--t-base)", marginBottom: "var(--s3)" }}>
        {existing ? "Правка карточки документа" : "Новый документ"}
      </h2>
      <Note kind="error">{failure}</Note>

      <div className="grid2">
        <Field label="Название">
          <input value={form.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field
          label="Адрес в URL (slug)"
          hint={existing?.published ? "Опубликован: переименование отклонит портал." : undefined}
        >
          <input
            value={form.slug}
            disabled={existing?.published}
            onChange={(e) => set("slug", e.target.value)}
          />
        </Field>
        <Field label="Раздел перечня">
          <select value={form.group} onChange={(e) => set("group", e.target.value)}>
            {vocabulary.groups.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </Field>
        <Field label="К чему относится" hint="Организация, производство или изделие.">
          <input value={form.subject} onChange={(e) => set("subject", e.target.value)} />
        </Field>
        <Field
          label="Уровень секретности"
          hint="Опубликовать можно только public — это ограничение схемы."
        >
          <select value={form.sensitivity} onChange={(e) => set("sensitivity", e.target.value)}>
            {vocabulary.sensitivities.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Бейдж доступа на сайте">
          <select value={form.access} onChange={(e) => set("access", e.target.value)}>
            {vocabulary.access.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </Field>
        <Field label="Изделие (slug)" hint="Пусто у общих документов.">
          <input
            value={form.productSlug ?? ""}
            onChange={(e) => set("productSlug", e.target.value || null)}
          />
        </Field>
        <Field label="Редакция">
          <input
            value={form.revision ?? ""}
            onChange={(e) => set("revision", e.target.value || null)}
          />
        </Field>
      </div>

      <label className="field field--row">
        <input
          type="checkbox"
          checked={form.listed}
          onChange={(e) => set("listed", e.target.checked)}
        />
        <span>Показывать строку в публичном перечне (это не публикация файла)</span>
      </label>

      <div className="row row--end">
        <button className="btn" onClick={onCancel}>
          Отмена
        </button>
        <button className="btn btn--primary" disabled={saving} onClick={() => void save()}>
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
