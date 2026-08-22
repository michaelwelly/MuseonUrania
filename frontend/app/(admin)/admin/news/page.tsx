"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  deleteNews,
  news,
  newsItem,
  newsTags,
  publishNews,
  updateNews,
  type News,
  type NewsRow,
} from "@/lib/admin";
import { plural } from "@/lib/plural";
import { Preview } from "../Preview";
import { Toggle } from "../Toggle";
import { useToast } from "../Toast";
import { useCounts } from "../counts";
import { SearchIcon } from "../icons";
import { BulkBar, HeadBox, useSelection } from "../lists";
import { Empty, Note, day, message, useLoad, when } from "../ui";

// Новости.
//
// Дата в ленте и видимость — разные вещи: материал готовят заранее и
// публикуют позже. Без даты опубликовать нельзя, это ограничение схемы,
// а не пожелание формы.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему у удаления нет отмены
//
// У публикации она есть: снятое возвращается тем же тумблером, и полоса
// внизу семь секунд держит путь назад. Удалённый черновик не возвращается
// ничем — записи больше нет. Поэтому удаление спрашивает до, а не предлагает
// отменить после: это единственное действие раздела, у которого нет обратного
// хода.

export default function NewsPage() {
  const toast = useToast();
  const counts = useCounts();
  const { data, error, loading, reload, setError } = useLoad<NewsRow[]>(news);
  const { data: tags } = useLoad<string[]>(newsTags);

  const [typed, setTyped] = useState("");
  const [pick, setPick] = useState<"all" | "live" | "draft">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<NewsRow | null>(null);
  const [what, setWhat] = useState<"" | "tag" | "drop">("");

  const all = useMemo(() => data ?? [], [data]);

  const rows = useMemo(() => {
    const низ = typed.trim().toLowerCase();
    return all.filter((n) => {
      if (pick === "live" && !n.published) return false;
      if (pick === "draft" && n.published) return false;
      if (!низ) return true;
      return (
        n.title.toLowerCase().includes(низ) ||
        n.slug.toLowerCase().includes(низ) ||
        n.tag.toLowerCase().includes(низ)
      );
    });
  }, [all, typed, pick]);

  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const selection = useSelection(ids);
  const выбранные = rows.filter((r) => selection.has(r.id));

  async function toggle(row: NewsRow) {
    setBusy(row.id);
    setError(null);
    try {
      await publishNews(row.id, !row.published);
      reload();
      counts.refresh();
      toast(
        row.published ? `«${row.title}» убрано из ленты` : `«${row.title}» в ленте`,
        async () => {
          await publishNews(row.id, row.published);
          reload();
        },
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  async function bulkPublish(on: boolean) {
    const работа = выбранные.filter((r) => r.published !== on);
    setError(null);

    const результат = await Promise.allSettled(работа.map((r) => publishNews(r.id, on)));
    const отказов = результат.filter((r) => r.status === "rejected").length;

    selection.clear();
    reload();
    counts.refresh();

    if (отказов > 0) {
      // Чаще всего это материал без даты в ленте: портал его не публикует.
      setError(
        `Не удалось изменить ${отказов} из ${работа.length}. Обычная причина — ` +
          "нет даты в ленте: без неё портал не публикует. Откройте отказавшие по одному.",
      );
      return;
    }

    toast(
      `${работа.length} ${plural(работа.length, "материал", "материала", "материалов")} ` +
        (on ? "в ленте" : "убрано из ленты"),
      async () => {
        await Promise.all(работа.map((r) => publishNews(r.id, !on)));
        reload();
      },
    );
  }

  return (
    <>
      <div className="admin-head">
        <h1>Новости</h1>
        <div className="row">
          <label className="find">
            <SearchIcon size={16} />
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Заголовок, адрес, тег"
              aria-label="Поиск по ленте"
              autoComplete="off"
            />
          </label>
          <Link className="btn btn--primary" href="/admin/news/new/">
            Написать материал
          </Link>
        </div>
      </div>

      <p className="admin-hint">
        Дата в ленте и видимость — разные вещи: материал готовят заранее и публикуют позже.
        Без даты опубликовать нельзя, это ограничение схемы, а не пожелание.
      </p>

      <div className="chips">
        {(
          [
            { id: "all", name: "Все" },
            { id: "live", name: "В ленте" },
            { id: "draft", name: "Черновики" },
          ] as const
        ).map((f) => {
          const сколько = all.filter((n) =>
            f.id === "live" ? n.published : f.id === "draft" ? !n.published : true,
          ).length;
          return (
            <span key={f.id} className={`chip${pick === f.id ? " chip--on" : ""}`}>
              <button
                type="button"
                className="chip__pick"
                aria-pressed={pick === f.id}
                onClick={() => {
                  setPick(f.id);
                  selection.clear();
                }}
              >
                {f.name}
                {data && <span className="chip__count mono">{сколько}</span>}
              </button>
            </span>
          );
        })}
      </div>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}

      <BulkBar
        count={selection.ids.length}
        what={plural(selection.ids.length, "материал", "материала", "материалов")}
        onClear={selection.clear}
      >
        <button className="btn btn--small" onClick={() => void bulkPublish(true)}>
          Опубликовать
        </button>
        <button className="btn btn--small" onClick={() => void bulkPublish(false)}>
          Убрать из ленты
        </button>
        <button
          className="btn btn--small"
          onClick={() => setWhat(what === "tag" ? "" : "tag")}
        >
          Сменить тег
        </button>
        <button className="btn btn--small btn--danger" onClick={() => setWhat("drop")}>
          Удалить
        </button>

        {what === "tag" && (
          <TagPicker
            rows={выбранные}
            tags={tags ?? []}
            onClose={() => setWhat("")}
            onDone={(tag, сколько) => {
              setWhat("");
              selection.clear();
              reload();
              toast(
                `Тег «${tag}» у ${сколько} ${plural(сколько, "материала", "материалов", "материалов")}`,
              );
            }}
            onError={setError}
          />
        )}
      </BulkBar>

      {what === "drop" && (
        <DropConfirm
          rows={выбранные}
          onCancel={() => setWhat("")}
          onDone={(сколько) => {
            setWhat("");
            selection.clear();
            reload();
            counts.refresh();
            // Без отмены: записи больше нет, и возвращать нечего.
            toast(
              `Удалено ${сколько} ${plural(сколько, "черновик", "черновика", "черновиков")}`,
            );
          }}
          onError={setError}
        />
      )}

      {data && rows.length === 0 && (
        <Empty>
          {all.length === 0
            ? "Лента пуста. Материал готовят здесь — на сайт уходит только опубликованное."
            : "По этому отбору материалов нет."}
        </Empty>
      )}

      {rows.length > 0 && (
        <div className="admin-scroll">
          <table className="admin-table admin-table--pick">
            <thead>
              <tr>
                <th className="tight">
                  <HeadBox selection={selection} rows={ids} what="материалы" />
                </th>
                <th>Заголовок</th>
                <th>Тег</th>
                <th>Дата в ленте</th>
                <th>На сайте</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={[
                    selection.has(row.id) ? "row--on" : "",
                    row.published ? "" : "row--wait",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <td className="tight">
                    <input
                      type="checkbox"
                      checked={selection.has(row.id)}
                      onChange={() => selection.toggle(row.id)}
                      aria-label={`Выбрать материал: ${row.title}`}
                    />
                  </td>

                  <td>
                    <Link className="row__name" href={`/admin/news/${row.id}/`}>
                      {row.title}
                    </Link>
                    <span className="row__under mono">/news/{row.slug}</span>
                  </td>

                  <td className="tight">
                    <span className="tag">{row.tag}</span>
                  </td>

                  <td className="tight mono">
                    {row.publishedOn ? (
                      day(row.publishedOn)
                    ) : (
                      <span className="nobody">даты нет</span>
                    )}
                  </td>

                  <td className="tight">
                    <Toggle
                      on={row.published}
                      busy={busy === row.id}
                      what={row.title}
                      onChange={() => void toggle(row)}
                    />
                  </td>

                  <td className="tight">
                    <button
                      type="button"
                      className="row__do"
                      onClick={() => setPreview(row)}
                      aria-label={`Предпросмотр: ${row.title}`}
                    >
                      предпросмотр
                    </button>
                    <Link
                      className="row__do row__do--on"
                      href={`/admin/news/${row.id}/`}
                      aria-label={`Правка: ${row.title}`}
                    >
                      правка
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && <NewsLook row={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

/**
 * Смена тега пачкой.
 *
 * Отдельной двери «поменять тег» у портала нет: тег меняется правкой
 * материала целиком, а форма правки требует версию. Поэтому каждый материал
 * сначала читается — иначе сохранение получит отказ по конфликту у всех,
 * кого правили после загрузки списка.
 */
function TagPicker({
  rows,
  tags,
  onClose,
  onDone,
  onError,
}: {
  rows: readonly NewsRow[];
  tags: readonly string[];
  onClose: () => void;
  onDone: (tag: string, count: number) => void;
  onError: (message: string | null) => void;
}) {
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);

  async function apply() {
    const выбран = tag.trim();
    if (!выбран) return;
    setBusy(true);
    onError(null);
    try {
      const свежие = await Promise.all(rows.map((r) => newsItem(r.id)));
      const результат = await Promise.allSettled(
        свежие.map((n: News) =>
          updateNews(n.id, {
            version: n.version,
            slug: n.slug,
            tag: выбран,
            title: n.title,
            excerpt: n.excerpt,
            body: n.body,
            imageSrc: n.imageSrc,
            imageAlt: n.imageAlt,
            publishedOn: n.publishedOn,
          }),
        ),
      );
      const отказов = результат.filter((r) => r.status === "rejected").length;
      if (отказов > 0) {
        onError(`Не удалось сменить тег у ${отказов} из ${rows.length}.`);
      }
      onDone(выбран, rows.length - отказов);
    } catch (e) {
      onError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bulk__pop" role="dialog" aria-label="Новый тег">
      <label className="field">
        <span>Тег</span>
        <input
          list="news-tags"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="Выберите или наберите"
          autoFocus
        />
        <datalist id="news-tags">
          {tags.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <small>Тег — свободное слово, а не запись: новый заведётся сам.</small>
      </label>

      <div className="row row--end">
        <button type="button" className="btn btn--small" onClick={onClose}>
          Отмена
        </button>
        <button
          type="button"
          className="btn btn--small btn--primary"
          disabled={busy || !tag.trim()}
          onClick={() => void apply()}
        >
          {busy ? "Меняем…" : "Сменить"}
        </button>
      </div>
    </div>
  );
}

/** Удаление черновиков. Спрашивает до, потому что отменять будет нечего. */
function DropConfirm({
  rows,
  onCancel,
  onDone,
  onError,
}: {
  rows: readonly NewsRow[];
  onCancel: () => void;
  onDone: (count: number) => void;
  onError: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const опубликованных = rows.filter((r) => r.published).length;
  const черновиков = rows.length - опубликованных;

  async function drop() {
    setBusy(true);
    onError(null);
    try {
      const работа = rows.filter((r) => !r.published);
      const результат = await Promise.allSettled(работа.map((r) => deleteNews(r.id)));
      const отказов = результат.filter((r) => r.status === "rejected").length;
      if (отказов > 0) onError(`Не удалось удалить ${отказов} из ${работа.length}.`);
      onDone(работа.length - отказов);
    } catch (e) {
      onError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="veil"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drop-title"
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      >
        <div className="sheet__head">
          <h2 id="drop-title">
            Удалить {черновиков} {plural(черновиков, "черновик", "черновика", "черновиков")}?
          </h2>
        </div>

        <p className="sheet__note">
          Возврата не будет: записи не станет, и отменять будет нечего. Это единственное
          действие раздела без обратного хода — снятое из ленты возвращается тумблером,
          удалённое не возвращается ничем.
        </p>

        {опубликованных > 0 && (
          <p className="note note--error">
            {опубликованных}{" "}
            {plural(опубликованных, "материал", "материала", "материалов")} из выбранных
            опубликован — такие не удаляются вовсе. Сначала уберите из ленты.
          </p>
        )}

        <div className="row row--end">
          <button type="button" className="btn" onClick={onCancel}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn--danger"
            disabled={busy || черновиков === 0}
            onClick={() => void drop()}
          >
            {busy ? "Удаляем…" : "Удалить"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Предпросмотр материала. Читается целиком: в строке списка нет ни анонса,
 *  ни текста — а смотрят именно на них. */
function NewsLook({ row, onClose }: { row: NewsRow; onClose: () => void }) {
  const { data, error } = useLoad<News>(() => newsItem(row.id), row.id);

  return (
    <Preview address={`/news/${row.slug}`} live={row.published} onClose={onClose}>
      {error && <p className="note note--error">{error}</p>}
      {!data && !error && <p className="muted">Читаем материал…</p>}

      {data && (
        <article className="look__article">
          <p className="look__eyebrow mono">
            {data.publishedOn ? day(data.publishedOn) : "даты в ленте нет"} · {data.tag}
          </p>
          <h1 className="look__title">{data.title}</h1>
          <p className="look__lead">{data.excerpt}</p>

          {data.imageSrc ? (
            <p className="look__shot mono">снимок: {data.imageSrc}</p>
          ) : (
            <p className="look__shot nobody">обложки нет — в ленте материал будет без картинки</p>
          )}

          <div className="look__text">
            {data.body ? (
              data.body.split("\n\n").map((кусок, i) => <p key={i}>{кусок}</p>)
            ) : (
              <p className="nobody">текст ожидает уточнения</p>
            )}
          </div>

          <p className="look__when mono">Изменено {when(data.updatedAt)}</p>
        </article>
      )}
    </Preview>
  );
}
