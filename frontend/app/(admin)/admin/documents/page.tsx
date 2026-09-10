"use client";

import { useMemo, useState } from "react";
import {
  createDocument,
  documentVocabulary,
  documents,
  knowledge,
  publishDocument,
  reindexKnowledge,
  updateDocument,
  uploadDocumentFile,
  type DocumentForm,
  type DocumentRow,
  type KnowledgeState,
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
  // Разряды по-русски: «2,9 МБ», а не «2.9 МБ». Весь остальной портал
  // набирает числа через toLocaleString, и точка здесь выдаёт чужой
  // формат посреди русского текста.
  if (мб >= 0.1) return `${мб.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

export default function DocumentsPage() {
  const { data, error, loading, reload, setError } = useLoad<DocumentRow[]>(documents);
  const { data: vocabulary } = useLoad<Vocabulary>(documentVocabulary);
  // Состояние индекса Ведалины живёт здесь, а не внутри своей карточки:
  // по нему же строки таблицы показывают, попал документ в поиск или нет.
  const {
    data: index,
    error: indexError,
    reload: reloadIndex,
    setError: setIndexError,
  } = useLoad<KnowledgeState>(knowledge);
  const [reindexing, setReindexing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<DocumentRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [typed, setTyped] = useState("");
  const [pick, setPick] = useState<"all" | "live" | "nofile" | "closed">("all");

  const all = useMemo(() => data ?? [], [data]);

  // Сколько фрагментов у документа в индексе — по slug. Перебирать список
  // индекса в каждой строке значит обходить его столько раз, сколько
  // документов; здесь он обходится один.
  const фрагменты = useMemo(() => {
    const карта = new Map<string, number>();
    for (const row of index?.rows ?? []) {
      if (row.kind === "document") карта.set(row.externalId, row.chunks);
    }
    return карта;
  }, [index]);

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

  // Переиндексация может идти секундами: разбор файлов и обращения к модели
  // эмбеддингов. Кнопка на это время гаснет — второе нажатие означало бы
  // второй прогон и второй счёт, а не «побыстрее».
  async function reindex() {
    setReindexing(true);
    setIndexError(null);
    try {
      await reindexKnowledge();
      reloadIndex();
    } catch (e) {
      setIndexError(message(e));
    } finally {
      setReindexing(false);
    }
  }

  async function act(id: string, action: () => Promise<unknown>) {
    setBusy(id);
    setError(null);
    try {
      await action();
      reload();
      // Правка документа поднимает переиндексацию событием, и она идёт
      // фоном. Перечитываем состояние индекса, чтобы строка не показывала
      // заведомо устаревшее «нет в индексе».
      reloadIndex();
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

      <KnowledgeIndex
        state={index}
        error={indexError}
        busy={reindexing}
        onReindex={reindex}
      />

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
                <th>Доступ</th>
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
                  // не публикуется, пока файл не загружен. Красная сильнее жёлтой.
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
                    {/* Статус индексации. Показываем только при включённой
                        индексации: при выключенной «нет в индексе» верно
                        у всех и потому не значит ничего. */}
                    {index?.enabled && (
                      <span className="row__under">
                        {фрагменты.has(row.slug) ? (
                          <>Ведалина ищет по нему: {фрагменты.get(row.slug)} фр.</>
                        ) : (
                          <span className="nobody">не в индексе Ведалины</span>
                        )}
                      </span>
                    )}
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
                    {/* Тип файла не называем.

                        В макете здесь «PDF · 1,2 МБ», и первое время так
                        и было. Но портал принимает не только PDF —
                        StorageLimits знает png, jpg, webp и svg, — а тип
                        загруженного файла в базе не хранится вовсе:
                        у Document есть file_size и нет content_type.
                        «PDF» в строке было бы утверждением, которое
                        неоткуда взять и которое однажды окажется ложью. */}
                    {row.hasFile ? (
                      <span className="mono">
                        {row.fileSize ? размер(row.fileSize) : "размер неизвестен"}
                      </span>
                    ) : (
                      <span className="nobody">файл не загружен</span>
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

/**
 * Индекс Ведалины: что в нём лежит и кнопка «переиндексировать».
 *
 * Стоит на странице документов, а не отдельным разделом: именно документы
 * составляют корпус, и вопрос «нашла ли Ведалина этот документ» возникает
 * здесь, рядом со строкой, а не через два перехода.
 *
 * Выключенная индексация — рабочее состояние, а не поломка: пока корпуса
 * нет, Ведалина отвечает поиском по словам. Карточка говорит это словами,
 * а не пустотой: пустой индекс при включённой индексации значит «ещё
 * не собирали», при выключенной — «и не собирается», и одинаково пустая
 * таблица в обоих случаях врала бы в одном из них.
 */
function KnowledgeIndex({
  state,
  error,
  busy,
  onReindex,
}: {
  state: KnowledgeState | null;
  error: string | null;
  busy: boolean;
  onReindex: () => void;
}) {
  // Двери индекса нет или она отказала — молчим. Отсутствие карточки
  // не мешает работать с документами, а красная плашка над таблицей
  // мешала бы каждый день.
  if (!state && !error) return null;

  return (
    <div className="admin-card">
      <div className="admin-head" style={{ marginBottom: "var(--s2)" }}>
        <h2 style={{ fontSize: "var(--t-base)" }}>Индекс Ведалины</h2>
        {state?.enabled && (
          <button className="btn btn--small" disabled={busy} onClick={onReindex}>
            {busy ? "Собираем…" : "Переиндексировать"}
          </button>
        )}
      </div>

      <Note kind="error">{error}</Note>

      {state && !state.enabled && (
        <p className="muted">
          Поиск по близости выключен: Ведалина отвечает поиском по словам, как и
          до появления индекса. Включается на стороне портала переменными{" "}
          <code>VEDAL_RAG_ENABLED</code>, <code>VEDAL_RAG_DOCUMENT_MODEL_URI</code> и{" "}
          <code>VEDAL_RAG_QUERY_MODEL_URI</code>.
        </p>
      )}

      {state?.enabled && (
        <p className="muted">
          В индексе <span className="mono">{state.sources}</span>{" "}
          {склонение(state.sources, "материал", "материала", "материалов")} и{" "}
          <span className="mono">{state.chunks}</span>{" "}
          {склонение(state.chunks, "фрагмент", "фрагмента", "фрагментов")}. Индекс
          догоняет правку сам; кнопка нужна, когда индексацию включили позже, чем
          правили документы. Материал с неизменившимся текстом не переиндексируется —
          повторное нажатие ничего не стоит.
        </p>
      )}
    </div>
  );
}

/** Русское число: 1 материал, 2 материала, 5 материалов. */
function склонение(сколько: number, один: string, два: string, много: string): string {
  const сотня = сколько % 100;
  if (сотня >= 11 && сотня <= 14) return много;
  const единицы = сколько % 10;
  if (единицы === 1) return один;
  if (единицы >= 2 && единицы <= 4) return два;
  return много;
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
        <span className="pub__word">сначала исправьте</span>
        <span className="pub__why">{row.publishBlockedBy}</span>
      </span>
    );
  }

  return <span className="pub pub--draft">черновик</span>;
}
