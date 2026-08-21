"use client";

import { useState } from "react";
import {
  addToHistory,
  history as loadHistory,
  type HistoryOf,
  type Interaction,
  type NewInteraction,
} from "@/lib/admin";
import { DIRECTION, INTERACTION_KIND, label } from "./labels";
import { Field, Note, message, useLoad, when } from "./ui";

// История переписки и звонков. Одна на заявку, клиента и сделку: запись
// у них одинаковая, отличается только тем, к чему привязана.
//
// Кнопок «править» и «удалить» здесь нет, и это не незаконченность.
// Дверь портала их не открывает: история, которую можно поправить задним
// числом, перестаёт быть историей ровно тогда, когда она нужна — при разборе
// спора о том, что клиенту обещали.

const EMPTY: NewInteraction = { kind: "call", direction: "in", at: null, subject: "", body: "" };

export default function History({ of, id }: { of: HistoryOf; id: string }) {
  const { data, error, loading, reload, setError } = useLoad<Interaction[]>(
    () => loadHistory(of, id),
    `${of}:${id}`,
  );
  const [entry, setEntry] = useState<NewInteraction>(EMPTY);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof NewInteraction>(key: K, value: NewInteraction[K]) =>
    setEntry((e) => ({ ...e, [key]: value }));

  async function add() {
    setSaving(true);
    setError(null);
    try {
      await addToHistory(of, id, {
        ...entry,
        // У заметки направления нет: портал примет и пустое, но отправлять
        // «звонок от клиента» под видом заметки не стоит.
        direction: entry.kind === "note" ? null : entry.direction,
      });
      setEntry(EMPTY);
      reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-card">
      <h2 className="admin-card__title">История</h2>
      <p className="admin-hint" style={{ marginBottom: "var(--s4)" }}>
        Только дописывается. Текст записи — персональные данные: в топики и в журнал он
        не уходит, туда идёт идентификатор.
      </p>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}

      {data?.length === 0 && <p className="admin-hint">Записей пока нет.</p>}

      {data && data.length > 0 && (
        <ol className="history">
          {data.map((row) => (
            <li key={row.id}>
              <div className="history__head">
                <span className="badge">{label(INTERACTION_KIND, row.kind)}</span>
                {row.direction && (
                  <span className="muted">{label(DIRECTION, row.direction)}</span>
                )}
                <span className="muted">{when(row.at)}</span>
                <span className="muted">· {row.actor}</span>
              </div>
              {row.subject && <div className="history__subject">{row.subject}</div>}
              <div className="history__body">{row.body}</div>
            </li>
          ))}
        </ol>
      )}

      <div className="history__form">
        <div className="grid2">
          <Field label="Вид записи">
            <select value={entry.kind} onChange={(e) => set("kind", e.target.value)}>
              {Object.entries(INTERACTION_KIND).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Направление"
            hint={entry.kind === "note" ? "У заметки направления нет." : undefined}
          >
            <select
              value={entry.direction ?? ""}
              disabled={entry.kind === "note"}
              onChange={(e) => set("direction", e.target.value || null)}
            >
              <option value="in">от клиента</option>
              <option value="out">клиенту</option>
            </select>
          </Field>
        </div>

        <Field label="Тема" hint="Коротко, одной строкой.">
          <input value={entry.subject} onChange={(e) => set("subject", e.target.value)} />
        </Field>

        <Field label="Что произошло">
          <textarea value={entry.body} onChange={(e) => set("body", e.target.value)} />
        </Field>

        <div className="row row--end">
          <button
            className="btn btn--primary"
            disabled={saving || !entry.body.trim()}
            onClick={() => void add()}
          >
            {saving ? "Записываем…" : "Записать"}
          </button>
        </div>
      </div>
    </div>
  );
}
