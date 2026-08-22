"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createNews,
  newsItem,
  newsTags,
  publishNews,
  updateNews,
  uploadMedia,
  type News,
  type NewsForm,
} from "@/lib/admin";
import { slugify } from "@/lib/translit";
import { Preview } from "../Preview";
import { useToast } from "../Toast";
import { Field, Note, day, fieldErrors, isConflict, message, useLoad } from "../ui";

// Форма материала.
//
// Слева то, что пишут, справа то, что проверяют перед публикацией. Раньше
// было одной колонкой сверху вниз, и вопрос «чего не хватает, чтобы
// опубликовать» решался нажатием «Опубликовать» и чтением отказа.
//
// ───────────────────────────────────────────────────────────────────────────
// Пределы настоящие
//
// Счётчик заголовка считает до 300, а не до 90: 300 — предел портала
// (`@Size(max = 300)`), а 90 было в макете. Счётчик, показывающий предел,
// которого нет, учит не доверять счётчикам.
//
// ───────────────────────────────────────────────────────────────────────────
// Конфликт версий
//
// Портал отбивает сохранение поверх чужой правки отказом 409. Кто именно
// правил, он не говорит — в отказе есть версия, но нет имени, — поэтому
// в полосе стоит «кто-то ещё», а не выдуманное имя. Отличия показываются
// настоящие: карточка перечитывается, и поля сравниваются по одному.

const ПРЕДЕЛ_ЗАГОЛОВКА = 300;
const ПРЕДЕЛ_АНОНСА = 1000;

const EMPTY: NewsForm = {
  version: 0,
  slug: "",
  tag: "Производство",
  title: "",
  excerpt: "",
  body: null,
  publishedOn: null,
  imageSrc: null,
  imageAlt: null,
};

export default function NewsEditor({ existing }: { existing?: News }) {
  const router = useRouter();
  const toast = useToast();
  // Рубрики закрыты проверкой в схеме. Берём список с портала, а не пишем
  // руками: разъехавшись, они дадут отказ базы вместо понятной ошибки.
  const { data: tags } = useLoad<string[]>(newsTags);

  const [form, setForm] = useState<NewsForm>(existing ? toForm(existing) : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [look, setLook] = useState(false);

  // Адрес перестаёт следовать за заголовком, как только его тронули руками:
  // редактор мог написать `vedal-r2-obzor` вместо `obzor-novogo-vedal-r2`,
  // и следующая буква заголовка не должна это стирать.
  const [slugTouched, setSlugTouched] = useState(Boolean(existing));

  // Чужая версия, из-за которой отказали. Держится до тех пор, пока человек
  // не решит, что с ней делать.
  const [чужая, setЧужая] = useState<News | null>(null);
  const [отличия, setОтличия] = useState(false);

  const set = <K extends keyof NewsForm>(key: K, value: NewsForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function setTitle(title: string) {
    setForm((f) => ({
      ...f,
      title,
      slug: slugTouched ? f.slug : slugify(title),
    }));
  }

  async function save(): Promise<News | null> {
    setSaving(true);
    setErrors({});
    setFailure(null);
    try {
      const saved = existing ? await updateNews(existing.id, form) : await createNews(form);
      // Версию берём из ответа: без этого второе сохранение подряд получит
      // 409 на ровном месте.
      setForm((f) => ({ ...f, version: saved.version }));
      setЧужая(null);
      setSavedAt(new Date().toLocaleTimeString("ru-RU", { timeStyle: "short" }));
      if (!existing) {
        router.push(`/admin/news/${saved.id}/`);
        router.refresh();
      }
      return saved;
    } catch (e) {
      setErrors(fieldErrors(e));
      setFailure(message(e));
      if (isConflict(e) && existing) {
        // Отличия показываются настоящие, а не «где-то что-то поменялось»:
        // карточка перечитывается, и поля сравниваются по одному.
        try {
          setЧужая(await newsItem(existing.id));
        } catch {
          // Перечитать не вышло — полоса останется без отличий,
          // но сам отказ человек уже увидел.
        }
      }
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    const saved = await save();
    if (!saved) return;
    try {
      await publishNews(saved.id, true);
      router.refresh();
      toast(`«${saved.title}» в ленте`, async () => {
        await publishNews(saved.id, false);
        router.refresh();
      });
    } catch (e) {
      setFailure(message(e));
    }
  }

  async function upload(file: File) {
    if (!form.slug) {
      setFailure("Сначала задайте адрес: из него собирается имя файла.");
      return;
    }
    try {
      const { path } = await uploadMedia(file, "news", form.slug);
      set("imageSrc", path);
    } catch (e) {
      setFailure(message(e));
    }
  }

  const готово = проверки(form);
  const мешает = готово.filter((п) => п.нужно && !п.есть).length;

  return (
    <>
      <div className="admin-head">
        <div className="deal__head">
          <h1>{existing ? "Правка материала" : "Новый материал"}</h1>
          <p className="deal__sub">
            {savedAt ? (
              <span className="muted mono">сохранено в {savedAt}</span>
            ) : (
              <span className="muted mono">
                {existing ? "изменений нет" : "ещё не сохранён"}
              </span>
            )}
          </p>
        </div>

        <div className="row">
          <button className="btn btn--small" onClick={() => setLook(true)}>
            Предпросмотр
          </button>
          <button className="btn" onClick={() => router.back()}>
            Отмена
          </button>
          <button className="btn" disabled={saving} onClick={() => void save()}>
            {saving ? "Сохраняем…" : "Сохранить черновик"}
          </button>
          <button
            className="btn btn--primary"
            disabled={saving || мешает > 0}
            title={
              мешает > 0
                ? "Сначала заполните то, без чего портал не опубликует, — список справа."
                : undefined
            }
            onClick={() => void publish()}
          >
            Опубликовать
          </button>
        </div>
      </div>

      <Note kind="error">{failure}</Note>

      {чужая && (
        <div className="clash">
          <p className="clash__title">Пока вы правили, карточку сохранил кто-то ещё</p>
          <p className="clash__body">
            Портал не говорит кто: в отказе есть версия, но нет имени. Ваша правка никуда
            не делась — она на экране, но сохранить её поверх чужой портал не даст.
          </p>

          <div className="row">
            <button className="btn btn--small" onClick={() => setОтличия((v) => !v)}>
              {отличия ? "Скрыть отличия" : "Показать отличия"}
            </button>
            <button
              className="btn btn--small btn--danger"
              title="Ваши правки на экране пропадут"
              onClick={() => {
                setForm(toForm(чужая));
                setЧужая(null);
                setОтличия(false);
                setFailure(null);
              }}
            >
              Взять его версию
            </button>
          </div>

          {отличия && <Diff mine={form} theirs={чужая} />}
        </div>
      )}

      <div className="editor">
        <div className="editor__main">
          <Field label="Заголовок" error={errors.title}>
            <input value={form.title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <p
            className={`counter mono${
              form.title.length > ПРЕДЕЛ_ЗАГОЛОВКА ? " counter--over" : ""
            }`}
          >
            Набрано: {form.title.length} из {ПРЕДЕЛ_ЗАГОЛОВКА}
          </p>

          <Field
            label="Адрес на сайте"
            error={errors.slug}
            hint={
              existing?.published
                ? "Материал опубликован: переименование отклонит портал — адрес уже разослан."
                : "Собирается из заголовка сам, пока его не тронули руками."
            }
          >
            <span className="slug">
              <span className="slug__prefix mono">/news/</span>
              <input
                className="mono"
                aria-label="Адрес материала на сайте"
                value={form.slug}
                disabled={existing?.published}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value);
                }}
              />
            </span>
          </Field>

          <div className="grid2">
            <Field label="Тег" error={errors.tag}>
              <select value={form.tag} onChange={(e) => set("tag", e.target.value)}>
                {(tags ?? [form.tag]).map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Дата в ленте"
              error={errors.publishedOn}
              hint="Без неё опубликовать нельзя: лента сортируется по ней."
            >
              <input
                className="mono"
                type="date"
                value={form.publishedOn ?? ""}
                onChange={(e) => set("publishedOn", e.target.value || null)}
              />
            </Field>
          </div>

          <Field label="Анонс" error={errors.excerpt} hint="Короткий текст для ленты.">
            <textarea
              rows={3}
              value={form.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
            />
          </Field>
          <p
            className={`counter mono${
              form.excerpt.length > ПРЕДЕЛ_АНОНСА ? " counter--over" : ""
            }`}
          >
            Набрано: {form.excerpt.length} из {ПРЕДЕЛ_АНОНСА}
          </p>

          <Field label="Текст материала" error={errors.body}>
            <textarea
              rows={14}
              value={form.body ?? ""}
              onChange={(e) => set("body", e.target.value || null)}
            />
          </Field>
          <p className="counter mono">Абзацы разделяются пустой строкой.</p>

          <Field label="Обложка">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </Field>
          {form.imageSrc && <p className="counter mono">{form.imageSrc}</p>}

          <Field
            label="Подпись к обложке"
            error={errors.imageAlt}
            hint="Её читает вслух программа для незрячих и показывает браузер, если снимок не загрузился."
          >
            <input
              value={form.imageAlt ?? ""}
              onChange={(e) => set("imageAlt", e.target.value || null)}
            />
          </Field>
        </div>

        <aside className="editor__side">
          <p className="side__eyebrow mono">Готовность к публикации</p>
          <ul className="check">
            {готово.map((п) => (
              // Незаполненное обязательное и незаполненное желательное
              // выглядели одинаково — оранжевым восклицательным знаком, —
              // хотя подпись под списком обещала, что различаются. Обещание
              // в подписи, которого не выполняет сам список, хуже
              // отсутствия подписи.
              <li
                key={п.что}
                className={`check__row${п.есть ? " check__row--on" : п.нужно ? " check__row--must" : ""}`}
              >
                <span className="check__mark" aria-hidden="true">
                  {п.есть ? "✓" : п.нужно ? "!" : "·"}
                </span>
                <span className="check__body">
                  <span className="check__what">{п.что}</span>
                  {!п.есть && <span className="check__why">{п.зачем}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="cols__note">
            Восклицательным знаком помечено то, без чего портал не опубликует; точкой —
            то, без чего материал выйдет хуже, но выйдет.
          </p>

          <p className="side__eyebrow mono">Как это будет в ленте</p>
          <div className="feed">
            <p className="feed__meta mono">
              {form.publishedOn ? day(form.publishedOn) : "даты нет"} · {form.tag}
            </p>
            <p className="feed__title">{form.title || "Заголовок ещё не набран"}</p>
            <p className="feed__lead">{form.excerpt || "Анонс ещё не набран"}</p>
          </div>
          <button className="btn btn--small" onClick={() => setLook(true)}>
            Показать целиком, как на сайте
          </button>
        </aside>
      </div>

      {look && (
        <Preview
          address={`/news/${form.slug || "адрес-ещё-не-задан"}`}
          live={Boolean(existing?.published)}
          onClose={() => setLook(false)}
        >
          <article className="look__article">
            <p className="look__eyebrow mono">
              {form.publishedOn ? day(form.publishedOn) : "даты в ленте нет"} · {form.tag}
            </p>
            <h1 className="look__title">{form.title || "Заголовок ещё не набран"}</h1>
            <p className="look__lead">{form.excerpt || "Анонс ещё не набран"}</p>

            {form.imageSrc ? (
              <p className="look__shot mono">
                обложка: {form.imageSrc}
                {form.imageAlt ? ` · ${form.imageAlt}` : " · подписи нет"}
              </p>
            ) : (
              <p className="look__shot nobody">обложки нет — в ленте будет без картинки</p>
            )}

            <div className="look__text">
              {form.body ? (
                form.body.split("\n\n").map((кусок, i) => <p key={i}>{кусок}</p>)
              ) : (
                <p className="nobody">текст ожидает уточнения</p>
              )}
            </div>
          </article>
        </Preview>
      )}
    </>
  );
}

/** Пункт готовности: что, зачем и обязателен ли он порталу. */
type Пункт = { что: string; зачем: string; есть: boolean; нужно: boolean };

/**
 * Чек-лист готовности.
 *
 * Обязательное отделено от желательного, и это не оформление: дата в ленте —
 * ограничение схемы, а обложка — вкус. Смешав их, интерфейс либо не даст
 * опубликовать материал без картинки, чего портал не требует, либо промолчит
 * про дату, без которой публикация отобьётся.
 */
function проверки(form: NewsForm): Пункт[] {
  return [
    {
      что: "Заголовок",
      зачем: "без него материал нечем назвать в ленте",
      есть: form.title.trim().length > 0,
      нужно: true,
    },
    {
      что: "Адрес на сайте",
      зачем: "по нему открывается страница материала",
      есть: form.slug.trim().length > 0,
      нужно: true,
    },
    {
      что: "Дата в ленте",
      зачем: "по ней лента сортируется; без неё портал не опубликует",
      есть: Boolean(form.publishedOn),
      нужно: true,
    },
    {
      что: "Анонс",
      зачем: "это то, что видно в ленте до перехода",
      есть: form.excerpt.trim().length > 0,
      нужно: true,
    },
    {
      что: "Текст",
      зачем: "страница без текста откроется пустой",
      есть: Boolean(form.body && form.body.trim()),
      нужно: false,
    },
    {
      что: "Обложка с подписью",
      зачем: "в ленте карточка будет без картинки, а подпись читают вслух",
      есть: Boolean(form.imageSrc && form.imageAlt),
      нужно: false,
    },
  ];
}

/** Чем моя версия отличается от чужой. Поле за полем, а не «что-то поменялось». */
function Diff({ mine, theirs }: { mine: NewsForm; theirs: News }) {
  const поля: [string, string, string][] = [
    ["Заголовок", mine.title, theirs.title],
    ["Адрес", mine.slug, theirs.slug],
    ["Тег", mine.tag, theirs.tag],
    ["Дата в ленте", mine.publishedOn ?? "", theirs.publishedOn ?? ""],
    ["Анонс", mine.excerpt, theirs.excerpt],
    ["Текст", mine.body ?? "", theirs.body ?? ""],
    ["Обложка", mine.imageSrc ?? "", theirs.imageSrc ?? ""],
  ];

  const разные = поля.filter(([, моё, чужое]) => моё !== чужое);

  if (разные.length === 0) {
    return (
      <p className="clash__body">
        Поля совпадают: разошлись только версии. Сохраните ещё раз — правка ляжет поверх.
      </p>
    );
  }

  return (
    <table className="diff">
      <thead>
        <tr>
          <th>Поле</th>
          <th>У вас</th>
          <th>На портале</th>
        </tr>
      </thead>
      <tbody>
        {разные.map(([имя, моё, чужое]) => (
          <tr key={имя}>
            <th>{имя}</th>
            <td>{кусок(моё)}</td>
            <td>{кусок(чужое)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Длинное поле показывается началом: отличие видно по первым словам. */
function кусок(text: string): React.ReactNode {
  if (!text) return <span className="nobody">пусто</span>;
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

function toForm(item: News): NewsForm {
  return {
    version: item.version,
    slug: item.slug,
    tag: item.tag,
    title: item.title,
    excerpt: item.excerpt,
    body: item.body,
    publishedOn: item.publishedOn,
    imageSrc: item.imageSrc,
    imageAlt: item.imageAlt,
  };
}
