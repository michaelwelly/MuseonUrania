"use client";

import { useState, type FormEvent } from "react";
import {
  conversationBoard,
  editConversationBoard,
  sendConversationDigest,
  type ConversationBoardRow,
} from "@/lib/admin";
import { Note, useLoad, when } from "../ui";
import styles from "./ConversationBoard.module.css";

const STAGES: Record<string, string> = {
  new: "Новый", clarification: "Уточнение", selection: "Подбор", ready_for_quote: "Готов к КП",
  handed_to_human: "Передан человеку", closed: "Закрыт",
};
const IMPORTANCE: Record<string, string> = { normal: "Обычная", high: "Высокая", urgent: "Срочная" };

export default function ConversationBoard({ beat, onOpen }: { beat: number; onOpen: (id: string) => void }) {
  const [stage, setStage] = useState("");
  const [owner, setOwner] = useState("");
  const [importance, setImportance] = useState("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<ConversationBoardRow | null>(null);
  const [digestStatus, setDigestStatus] = useState("");
  const [sendingDigest, setSendingDigest] = useState(false);
  const { data, error } = useLoad(() => conversationBoard(stage, owner, importance, page),
    `${stage}:${owner}:${importance}:${page}:${beat}:${revision}`);

  return <section className={styles.board} aria-label="Табло разговоров">
    <div className={styles.heading}>
      <h2>Табло разговоров</h2>
      <button
        type="button"
        disabled={sendingDigest}
        onClick={async () => {
          setSendingDigest(true);
          setDigestStatus("");
          try {
            const result = await sendConversationDigest();
            setDigestStatus(result.queued
              ? `Отчёт за ${result.date} поставлен в очередь`
              : `Отчёт за ${result.date} уже был создан`);
          } catch (error) {
            setDigestStatus(error instanceof Error ? error.message : "Не удалось создать отчёт");
          } finally {
            setSendingDigest(false);
          }
        }}
      >
        {sendingDigest ? "Создаём отчёт…" : "Отправить отчёт сейчас"}
      </button>
      <span className="muted">{data ? `${data.total} разговоров` : "Загружаем…"}</span>
    </div>
    {digestStatus && <p role="status">{digestStatus}</p>}
    <p className="muted">Кратко — последнее значимое сообщение посетителя. Стадию готовности к КП подтверждает сотрудник.</p>
    <div className={styles.filters}>
      <label>Стадия<select value={stage} onChange={(e) => { setStage(e.target.value); setPage(0); }}><option value="">Все стадии</option>{Object.entries(STAGES).map(([v, title]) => <option key={v} value={v}>{title}</option>)}</select></label>
      <label>Ответственный<input value={owner} placeholder="Логин; - без ответственного" onChange={(e) => { setOwner(e.target.value); setPage(0); }} /></label>
      <label>Важность<select value={importance} onChange={(e) => { setImportance(e.target.value); setPage(0); }}><option value="">Любая важность</option>{Object.entries(IMPORTANCE).map(([v, title]) => <option key={v} value={v}>{title}</option>)}</select></label>
    </div>
    <Note kind="error">{error}</Note>
    {data && data.items.length === 0 && <p>По этим фильтрам разговоров нет.</p>}
    {data && data.items.length > 0 && <div className={styles.scroll}><table className={styles.table}>
      <thead><tr><th>Кратко</th><th>Стадия</th><th>Ответственный</th><th>Важность</th><th>Следующий шаг</th><th>Обновлено</th><th>Действия</th></tr></thead>
      <tbody>{data.items.map((row) => <tr key={row.id}>
        <td>{row.summary || "Задача ещё не сформулирована"}{row.manual && <small className={styles.manual}>Правка сотрудника</small>}</td>
        <td>{STAGES[row.stage]}</td><td>{row.owner || "Не назначен"}</td><td>{IMPORTANCE[row.importance]}</td>
        <td>{row.nextAction}</td><td>{when(row.updatedAt)}</td>
        <td><button type="button" onClick={() => onOpen(row.id)}>Разговор</button><button type="button" onClick={() => setEditing(row)}>Исправить</button></td>
      </tr>)}</tbody>
    </table></div>}
    {data && data.pages > 1 && <div className={styles.filters}><button disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</button><span>Страница {page + 1} из {data.pages}</span><button disabled={page + 1 >= data.pages} onClick={() => setPage(page + 1)}>Далее</button></div>}
    {editing && <Editor key={editing.id} row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setRevision(revision + 1); }} />}
  </section>;
}

function Editor({ row, onClose, onSaved }: { row: ConversationBoardRow; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState({ ...row, manual: true });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try { await editConversationBoard(draft); onSaved(); }
    catch (error) { setError(error instanceof Error ? error.message : "Не удалось сохранить"); }
    finally { setSaving(false); }
  }
  return <form className={styles.editor} onSubmit={save} aria-label="Исправление табло">
    <h3>Исправить сведения о разговоре</h3>
    <label>Кратко<textarea required maxLength={600} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></label>
    <div className={styles.filters}>
      <label>Стадия разговора<select value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value })}>{Object.entries(STAGES).map(([v, title]) => <option key={v} value={v}>{title}</option>)}</select></label>
      <label>Логин ответственного<input maxLength={200} value={draft.owner ?? ""} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} /></label>
      <label>Важность разговора<select value={draft.importance} onChange={(e) => setDraft({ ...draft, importance: e.target.value })}>{Object.entries(IMPORTANCE).map(([v, title]) => <option key={v} value={v}>{title}</option>)}</select></label>
    </div>
    <label>Следующий шаг<textarea required maxLength={600} value={draft.nextAction} onChange={(e) => setDraft({ ...draft, nextAction: e.target.value })} /></label>
    <label><input type="checkbox" checked={draft.manual} onChange={(e) => setDraft({ ...draft, manual: e.target.checked })} /> Сохранять ручные правки при новых сообщениях</label>
    {!draft.manual && <p>При сохранении резюме, стадия, важность и следующий шаг будут рассчитаны заново по переписке.</p>}
    <Note kind="error">{error}</Note>
    <div className={styles.filters}><button disabled={saving} type="submit">{saving ? "Сохраняем…" : "Сохранить"}</button><button type="button" disabled={saving} onClick={onClose}>Отмена</button></div>
  </form>;
}
