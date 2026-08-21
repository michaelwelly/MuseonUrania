"use client";

import { useMemo, useState } from "react";
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
import { SearchIcon } from "../icons";
import { DOC_ACCESS, DOC_SENSITIVITY, label } from "../labels";
import { Empty, Field, message, Note, useLoad } from "../ui";

// Документы — единственное место админки, где правило доступа видно прямо
// в интерфейсе: строка знает, почему её нельзя опубликовать, и говорит это
// до нажатия. Те же три правила закрыты ограничениями схемы, так что обойти
// их правкой интерфейса нельзя.

const MAX_MB = 20;

/**
 * Размер файла человеку.
 *
 * «0.0 МБ» читается как поломка счётчика, а означает файл меньше пятидесяти
 * килобайт — например, однострочный PDF-заглушку, которую редактор загрузил
 * по ошибке. В килобайтах это видно сразу.
 */
function размер(bytes: number): string {
  const мб = bytes / 1024 / 1024;
  if (мб >= 0.1) return `${мб.toFixed(1)} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

export default function DocumentsPage() {
  const { data, error, loading, reload, setError } = useLoad<DocumentRow[]>(documents);
  const { data: vocabulary } = useLoad<Vocabulary>(documentVocabulary);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<DocumentRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [typed, setTyped] = useState("");
  const [pick, setPick] = useState<"all" | "live" | "nofile" | "closed">("all");

  const all = useMemo(() => data ?? [], [data]);

  // Отбор по прочитанному списку, а не запросом: документов десять, портал
  // отдаёт их целиком, и «ничего не найдено» здесь означает «во всём
  // перечне ничего не найдено» — потому что весь перечень и есть то,
  // что прочитано.
  const rows = useMemo(() => {
    const низ = typed.trim().toLowerCase();
    return all.filter((d) => {
      if (pick === "live" && !d.published) return false;
      if (pick === "nofile" && d.hasFile) return false;
      if (pick === "closed" && d.sensitivity === "public") return false;
      if (!низ) return true;
      return (
        d.title.toLowerCase().includes(низ) ||
        d.slug.toLowerCase().includes(низ) ||
        d.group.toLowerCase().includes(низ)
      );
    });
  }, [all, typed, pick]);

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
        <div className="row">
          <label className="find">
            <SearchIcon size={16} />
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Название, адрес, раздел"
              aria-label="Поиск по документам"
              autoComplete="off"
            />
          </label>
          <button className="btn btn--primary" onClick={() => setCreating(true)}>
            Завести документ
          </button>
        </div>
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

      <div className="chips">
        {(
          [
            { id: "all", name: "Все" },
            { id: "live", name: "На сайте" },
            { id: "nofile", name: "Без файла" },
            { id: "closed", name: "Закрытые" },
          ] as const
        ).map((f) => {
          const сколько = all.filter((d) =>
            f.id === "live"
              ? d.published
              : f.id === "nofile"
                ? !d.hasFile
                : f.id === "closed"
                  ? d.sensitivity !== "public"
                  : true,
          ).length;
          return (
            <span key={f.id} className={`chip${pick === f.id ? " chip--on" : ""}`}>
              <button
                type="button"
                className="chip__pick"
                aria-pressed={pick === f.id}
                onClick={() => setPick(f.id)}
              >
                {f.name}
                {data && <span className="chip__count mono">{сколько}</span>}
              </button>
            </span>
          );
        })}
      </div>

      {loading && !data && <p className="muted">Загружаем…</p>}

      {data && rows.length === 0 && (
        <Empty>
          {all.length === 0
            ? "Документов пока нет. Здесь заводятся карточки, а файл к ним прикладывается отдельно."
            : "По этому отбору документов нет."}
        </Empty>
      )}

      {rows.length > 0 && (
        <div className="admin-scroll">
          <table className="admin-table admin-table--pick">
            <thead>
              <tr>
                <th>Документ</th>
                <th>Раздел</th>
                <th>Чувствительность</th>
                <th>Файл</th>
                <th>Публикация</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  // Две приметы, и обе про то, чего нельзя: конфиденциальный
                  // документ наружу не выходит никогда, документ без файла
                  // не публикуется, пока файла нет. Красная сильнее жёлтой.
                  className={
                    row.sensitivity === "confidential"
                      ? "row--stop"
                      : !row.hasFile
                        ? "row--wait"
                        : ""
                  }
                >
                  <td>
                    <button
                      type="button"
                      className="inline-edit"
                      onClick={() => setEditing(row)}
                      aria-label={`Правка карточки: ${row.title}`}
                    >
                      <span className="row__name">{row.title}</span>
                    </button>
                    <span className="row__under mono">{row.slug}</span>
                    <span className="row__under">{row.subject}</span>
                  </td>

                  <td className="tight">{row.group}</td>

                  <td className="tight">
                    <span
                      className={`badge ${
                        row.sensitivity === "public" ? "badge--on" : "badge--stop"
                      }`}
                    >
                      {label(DOC_SENSITIVITY, row.sensitivity)}
                    </span>
                    <span className="row__under">{label(DOC_ACCESS, row.access)}</span>
                  </td>

                  <td className="tight">
                    {row.hasFile ? (
                      <span className="mono">
                        PDF · {row.fileSize ? размер(row.fileSize) : "размер неизвестен"}
                      </span>
                    ) : (
                      <span className="nobody">файла нет</span>
                    )}
                    <label className="file">
                      <span className="file__word">{row.hasFile ? "заменить" : "загрузить"}</span>
                      <input
                        aria-label={`Файл документа: ${row.title}`}
                        type="file"
                        disabled={busy === row.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void upload(row, file);
                        }}
                      />
                    </label>
                  </td>

                  <td className="tight">
                    <Publication row={row} />
                  </td>

                  <td className="tight">
                    <button
                      className="btn btn--small"
                      disabled={
                        busy === row.id || (!row.published && row.publishBlockedBy !== null)
                      }
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
              <option key={s} value={s}>
                {label(DOC_SENSITIVITY, s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Бейдж доступа на сайте">
          <select value={form.access} onChange={(e) => set("access", e.target.value)}>
            {vocabulary.access.map((a) => (
              <option key={a} value={a}>
                {label(DOC_ACCESS, a)}
              </option>
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

/**
 * Что с публикацией — одной фразой.
 *
 * Раньше здесь стояла метка «опубликовано / черновик», а причина запрета
 * лежала отдельной строчкой ниже. Читалось это как два разных сообщения,
 * и связать их приходилось самому. Состояний тут на самом деле четыре,
 * и каждое — законченный ответ на вопрос «что с ним сейчас».
 *
 * Причину запрета сочиняет портал, а не интерфейс: правила лежат
 * в ограничениях схемы, и переписанные сюда они разъедутся с ними молча.
 */
function Publication({ row }: { row: DocumentRow }) {
  if (row.published) {
    return (
      <span className={row.listed ? "pub pub--live" : "pub pub--inside"}>
        {row.listed ? "на сайте" : "только внутри"}
      </span>
    );
  }

  if (row.publishBlockedBy) {
    return (
      <span className="pub pub--no">
        <span className="pub__word">нельзя</span>
        <span className="pub__why">{row.publishBlockedBy}</span>
      </span>
    );
  }

  return <span className="pub pub--draft">черновик</span>;
}
