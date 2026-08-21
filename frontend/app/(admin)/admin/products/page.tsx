"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  categories as loadCategories,
  product as loadProduct,
  products,
  publishProduct,
  updateProduct,
  type Category,
  type Product,
  type ProductRow,
} from "@/lib/admin";
import { plural } from "@/lib/plural";
import { Preview } from "../Preview";
import { Toggle } from "../Toggle";
import { useToast } from "../Toast";
import { useCounts } from "../counts";
import { SearchIcon } from "../icons";
import { BulkBar, Columns, HeadBox, useSelection, useStored, type Column } from "../lists";
import { Empty, Note, message, useLoad, when } from "../ui";

// Продукция.
//
// Здесь видно всё, включая черновики: публичный каталог показывает только
// опубликованное. Отсюда и главная примета строки — тумблер «на сайте»,
// а не кнопка «опубликовать»: список читают на вопрос «что сейчас», а кнопка
// отвечала на вопрос «что случится», и её приходилось выворачивать наизнанку.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему отбор здесь в браузере, а в заявках — на портале
//
// Каталог отдаётся списком целиком: у портала нет постраничной двери для
// изделий, и не нужно — их тринадцать, а будет пятьдесят. Отбор по уже
// прочитанному списку в этом случае не врёт: «ничего не найдено» означает
// «во всём каталоге ничего не найдено», потому что весь каталог и есть
// то, что прочитано.
//
// В заявках всё наоборот: их сорок восемь тысяч, страница пятьдесят,
// и тот же приём начал бы врать со второй страницы.
//
// ───────────────────────────────────────────────────────────────────────────
// Категории правятся флажками, а не строкой
//
// В макете значение превращается в поле ввода. Поле ввода принимает любое
// слово, а категория — запись со своим адресом: набранное мимо либо тихо
// пропадёт, либо заведёт вторую «Неонатологию» рядом с первой. Флажки
// показывают, из чего выбирают, и мимо не попадают.

const КОЛОНКИ: readonly Column[] = [
  { key: "cats", label: "Категории" },
  { key: "docs", label: "Данные" },
  { key: "changed", label: "Изменено" },
];

const ПО_УМОЛЧАНИЮ = ["cats", "docs", "changed"];

type Отбор = "all" | "live" | "draft" | "nodocs";

const ФИЛЬТРЫ: readonly { id: Отбор; name: string }[] = [
  { id: "all", name: "Все" },
  { id: "live", name: "На сайте" },
  { id: "draft", name: "Черновики" },
  { id: "nodocs", name: "Ожидают уточнения" },
];

export default function ProductsPage() {
  const toast = useToast();
  const counts = useCounts();
  const { data, error, loading, reload, setError } = useLoad<ProductRow[]>(products);
  const { data: cats } = useLoad<Category[]>(loadCategories);

  const [shown, setShown] = useStored<string[]>("vedal.admin.products.columns", ПО_УМОЛЧАНИЮ);
  const [typed, setTyped] = useState("");
  const [pick, setPick] = useState<Отбор>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProductRow | null>(null);

  const all = useMemo(() => data ?? [], [data]);

  const rows = useMemo(() => {
    const низ = typed.trim().toLowerCase();
    return all.filter((p) => {
      if (pick === "live" && !p.published) return false;
      if (pick === "draft" && p.published) return false;
      if (pick === "nodocs" && p.docStatus === "confirmed") return false;
      if (!низ) return true;
      return (
        p.name.toLowerCase().includes(низ) ||
        p.slug.toLowerCase().includes(низ) ||
        p.categories.some((c) => c.toLowerCase().includes(низ))
      );
    });
  }, [all, typed, pick]);

  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const selection = useSelection(ids);
  const видно = (key: string) => shown.includes(key);

  async function toggle(row: ProductRow) {
    setBusy(row.id);
    setError(null);
    try {
      await publishProduct(row.id, !row.published);
      reload();
      counts.refresh();
      toast(
        row.published ? `«${row.name}» снято с публикации` : `«${row.name}» опубликовано`,
        async () => {
          await publishProduct(row.id, row.published);
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
    const выбранные = rows.filter((r) => selection.has(r.id));
    // Только те, у кого состояние другое: публиковать опубликованное —
    // это запрос, который ничего не меняет, но может отказать.
    const работа = выбранные.filter((r) => r.published !== on);
    setError(null);

    const результат = await Promise.allSettled(
      работа.map((r) => publishProduct(r.id, on)),
    );
    const отказов = результат.filter((r) => r.status === "rejected").length;

    selection.clear();
    reload();
    counts.refresh();

    if (отказов > 0) {
      setError(
        `Не удалось изменить ${отказов} из ${работа.length}. Остальные изменены; ` +
          "откройте отказавшие по одному, чтобы увидеть причину.",
      );
      return;
    }

    toast(
      `${работа.length} ${plural(работа.length, "изделие", "изделия", "изделий")} ` +
        (on ? "опубликовано" : "снято с публикации"),
      async () => {
        await Promise.all(работа.map((r) => publishProduct(r.id, !on)));
        reload();
      },
    );
  }

  return (
    <>
      <div className="admin-head">
        <h1>Продукция</h1>
        <div className="row">
          <label className="find">
            <SearchIcon size={16} />
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Название, адрес, категория"
              aria-label="Поиск по каталогу"
              autoComplete="off"
            />
          </label>
          <Columns columns={КОЛОНКИ} shown={shown} onChange={setShown} />
          <Link className="btn btn--primary" href="/admin/products/new/">
            Завести изделие
          </Link>
        </div>
      </div>

      <p className="admin-hint">
        Переименовать опубликованное изделие нельзя — адрес карточки уже разослан
        и проиндексирован; сначала снимите с публикации.
      </p>

      <div className="chips">
        {ФИЛЬТРЫ.map((f) => {
          const сколько = all.filter((p) => {
            if (f.id === "live") return p.published;
            if (f.id === "draft") return !p.published;
            if (f.id === "nodocs") return p.docStatus !== "confirmed";
            return true;
          }).length;
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
        what={plural(selection.ids.length, "изделие", "изделия", "изделий")}
        onClear={selection.clear}
      >
        <button className="btn btn--small" onClick={() => void bulkPublish(true)}>
          Опубликовать
        </button>
        <button className="btn btn--small" onClick={() => void bulkPublish(false)}>
          Снять с публикации
        </button>
      </BulkBar>

      {data && rows.length === 0 && (
        <Empty>
          {all.length === 0
            ? "Изделий пока нет. Каталог наполняется здесь — на сайт уходит только опубликованное."
            : "По этому отбору изделий нет."}
        </Empty>
      )}

      {rows.length > 0 && (
        <div className="admin-scroll">
          <table className="admin-table admin-table--pick">
            <thead>
              <tr>
                <th className="tight">
                  <HeadBox selection={selection} rows={ids} what="изделия" />
                </th>
                <th>Изделие</th>
                {видно("cats") && <th>Категории</th>}
                {видно("docs") && <th>Данные</th>}
                <th>На сайте</th>
                {видно("changed") && <th>Изменено</th>}
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
                      aria-label={`Выбрать изделие: ${row.name}`}
                    />
                  </td>

                  <td>
                    <span className="thing">
                      {/* Снимок или его отсутствие: изделие без фотографии
                          выглядит на сайте пустой рамкой, и увидеть такие
                          надо списком, а не открывая каждое. */}
                      <span
                        className={`thumb${row.imageSrc ? "" : " thumb--none"}`}
                        title={row.imageSrc ?? "снимка нет"}
                        aria-hidden="true"
                      />
                      <span className="thing__body">
                        <Link className="row__name" href={`/admin/products/${row.id}/`}>
                          {row.name}
                        </Link>
                        <span className="row__under mono">{row.slug}</span>
                      </span>
                    </span>
                  </td>

                  {видно("cats") && (
                    <td className="tight">
                      <button
                        type="button"
                        className="inline-edit"
                        aria-label={`Правка категорий: ${row.name}`}
                        onClick={() => setEditing(editing === row.id ? null : row.id)}
                      >
                        {row.categories.join(", ") || <span className="nobody">нет категории</span>}
                      </button>

                      {editing === row.id && (
                        <CategoryPicker
                          row={row}
                          all={cats ?? []}
                          onClose={() => setEditing(null)}
                          onSaved={() => {
                            setEditing(null);
                            reload();
                          }}
                          onError={setError}
                        />
                      )}
                    </td>
                  )}

                  {видно("docs") && (
                    <td className="tight">
                      <span
                        className={`badge ${row.docStatus === "confirmed" ? "" : "badge--warn"}`}
                      >
                        {row.docStatus === "confirmed" ? "по датащиту" : "ожидает уточнения"}
                      </span>
                    </td>
                  )}

                  <td className="tight">
                    <Toggle
                      on={row.published}
                      busy={busy === row.id}
                      what={row.name}
                      onChange={() => void toggle(row)}
                    />
                  </td>

                  {видно("changed") && <td className="tight mono">{when(row.updatedAt)}</td>}

                  <td className="tight">
                    <button
                      type="button"
                      className="row__do"
                      onClick={() => setPreview(row)}
                      aria-label={`Предпросмотр: ${row.name}`}
                    >
                      предпросмотр
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <ProductLook row={preview} onClose={() => setPreview(null)} />
      )}
    </>
  );
}

/**
 * Выбор категорий флажками.
 *
 * Открытие читает изделие целиком: в строке списка лежат названия категорий,
 * а сохранять надо адреса, и сопоставлять их по названию значит промахнуться
 * на первой же паре одноимённых. Заодно приезжает свежая версия карточки —
 * без неё сохранение получит отказ по конфликту.
 */
function CategoryPicker({
  row,
  all,
  onClose,
  onSaved,
  onError,
}: {
  row: ProductRow;
  all: readonly Category[];
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string | null) => void;
}) {
  const { data, error } = useLoad<Product>(() => loadProduct(row.id), row.id);
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  const выбрано = chosen ?? data?.categorySlugs ?? [];

  async function save() {
    if (!data) return;
    setSaving(true);
    onError(null);
    try {
      await updateProduct(row.id, {
        version: data.version,
        slug: data.slug,
        name: data.name,
        kind: data.kind,
        summary: data.summary,
        detail: data.detail,
        purpose: data.purpose,
        features: data.features,
        docStatus: data.docStatus,
        sortOrder: data.sortOrder,
        imageSrc: data.imageSrc,
        imageAlt: data.imageAlt,
        categorySlugs: выбрано,
        keyParams: data.keyParams,
        specs: data.specs,
      });
      onSaved();
    } catch (e) {
      onError(message(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cols__panel cols__panel--left" role="dialog" aria-label="Категории изделия">
      {error && <p className="note note--error">{error}</p>}
      {!data && !error && <p className="muted">Читаем карточку…</p>}

      {data &&
        all.map((c) => (
          <label key={c.id} className="cols__row">
            <input
              type="checkbox"
              checked={выбрано.includes(c.slug)}
              onChange={(e) =>
                setChosen(
                  e.target.checked
                    ? [...выбрано, c.slug]
                    : выбрано.filter((s) => s !== c.slug),
                )
              }
            />
            <span>{c.name}</span>
          </label>
        ))}

      {data && all.length === 0 && (
        <p className="cols__note">
          Категорий пока нет. Заводятся они в разделе «Категории».
        </p>
      )}

      <div className="row row--end">
        <button type="button" className="btn btn--small" onClick={onClose}>
          Отмена
        </button>
        <button
          type="button"
          className="btn btn--small btn--primary"
          disabled={!data || saving}
          onClick={() => void save()}
        >
          {saving ? "Сохраняем…" : "OK"}
        </button>
      </div>
    </div>
  );
}

/** Предпросмотр карточки изделия. Карточка читается целиком: в строке
 *  списка нет ни назначения, ни характеристик — а смотрят именно на них. */
function ProductLook({ row, onClose }: { row: ProductRow; onClose: () => void }) {
  const { data, error } = useLoad<Product>(() => loadProduct(row.id), row.id);

  return (
    <Preview address={`/products/${row.slug}`} live={row.published} onClose={onClose}>
      {error && <p className="note note--error">{error}</p>}
      {!data && !error && <p className="muted">Читаем карточку…</p>}

      {data && (
        <article className="look__article">
          <p className="look__eyebrow mono">{data.kind}</p>
          <h1 className="look__title">{data.name}</h1>
          <p className="look__lead">{data.summary}</p>

          <p className="look__text">
            {data.purpose ?? <span className="nobody">назначение ожидает уточнения</span>}
          </p>

          {data.features.length > 0 && (
            <ul className="look__list">
              {data.features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}

          {data.keyParams.length > 0 && (
            <table className="look__specs">
              <tbody>
                {data.keyParams.map((s, i) => (
                  <tr key={i}>
                    <th>{s.label}</th>
                    <td className={s.muted ? "nobody" : "mono"}>{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="look__price mono">Цена — по запросу</p>
        </article>
      )}
    </Preview>
  );
}
