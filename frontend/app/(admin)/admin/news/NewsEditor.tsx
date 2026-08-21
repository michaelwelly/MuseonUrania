"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createNews,
  newsTags,
  updateNews,
  uploadMedia,
  type News,
  type NewsForm,
} from "@/lib/admin";
import { Field, Note, fieldErrors, message, useLoad } from "../ui";

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
  // Рубрики закрыты проверкой в схеме. Берём список с портала, а не пишем
  // руками: разъехавшись, они дадут отказ базы вместо понятной ошибки.
  const { data: tags } = useLoad<string[]>(newsTags);

  const [form, setForm] = useState<NewsForm>(existing ? toForm(existing) : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof NewsForm>(key: K, value: NewsForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setSaving(true);
    setErrors({});
    setFailure(null);
    try {
      const saved = existing ? await updateNews(existing.id, form) : await createNews(form);
      router.push(`/admin/news/${saved.id}/`);
      router.refresh();
    } catch (e) {
      setErrors(fieldErrors(e));
      setFailure(message(e));
    } finally {
      setSaving(false);
    }
  }

  async function upload(file: File) {
    if (!form.slug) {
      setFailure("Сначала задайте slug: из него собирается имя файла.");
      return;
    }
    try {
      const { path } = await uploadMedia(file, "news", form.slug);
      set("imageSrc", path);
    } catch (e) {
      setFailure(message(e));
    }
  }

  return (
    <>
      <Note kind="error">{failure}</Note>

      <div className="admin-card">
        <Field label="Заголовок" error={errors.title}>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} />
        </Field>

        <div className="grid2">
          <Field
            label="Адрес в URL (slug)"
            error={errors.slug}
            hint={
              existing?.published
                ? "Материал опубликован: переименование отклонит портал."
                : "Латиница в нижнем регистре, цифры и дефис."
            }
          >
            <input
              aria-label="Адрес новости (slug)"
              value={form.slug}
              disabled={existing?.published}
              onChange={(e) => set("slug", e.target.value)}
            />
          </Field>

          <Field label="Рубрика" error={errors.tag}>
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
              type="date"
              value={form.publishedOn ?? ""}
              onChange={(e) => set("publishedOn", e.target.value || null)}
            />
          </Field>

          <Field label="Подпись к иллюстрации" error={errors.imageAlt}>
            <input
              value={form.imageAlt ?? ""}
              onChange={(e) => set("imageAlt", e.target.value || null)}
            />
          </Field>
        </div>

        <Field label="Анонс" error={errors.excerpt} hint="Короткий текст для ленты.">
          <textarea value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
        </Field>

        <Field label="Текст материала" error={errors.body}>
          <textarea
            value={form.body ?? ""}
            onChange={(e) => set("body", e.target.value || null)}
            style={{ minHeight: 220 }}
          />
        </Field>

        <Field label="Иллюстрация">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </Field>
        {form.imageSrc && <p className="mono">{form.imageSrc}</p>}
      </div>

      <div className="row row--end">
        <button className="btn" onClick={() => router.back()}>
          Отмена
        </button>
        <button className="btn btn--primary" disabled={saving} onClick={() => void save()}>
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </>
  );
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
