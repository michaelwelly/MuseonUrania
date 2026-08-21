"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  categories as loadCategories,
  createProduct,
  updateProduct,
  uploadMedia,
  type Category,
  type Product,
  type ProductForm,
  type Spec,
} from "@/lib/admin";
import { Field, Note, fieldErrors, message, useLoad } from "../ui";

// Форма изделия. Одна на создание и на правку: поля и правила у них общие,
// а разница — в том, куда уходит сохранение.
//
// Поля published здесь нет намеренно. Публикация — отдельное действие
// в списке: снятие с публикации убирает изделие с сайта, и это не должно
// случаться заодно с правкой опечатки в описании.

const EMPTY: ProductForm = {
  // Новая карточка версии не имеет: портал игнорирует её при создании.
  version: 0,
  slug: "",
  name: "",
  kind: "",
  summary: "",
  detail: null,
  purpose: null,
  features: [],
  docStatus: "pending",
  sortOrder: 0,
  imageSrc: null,
  imageAlt: null,
  categorySlugs: [],
  keyParams: [],
  specs: [],
};

export default function ProductEditor({ existing }: { existing?: Product }) {
  const router = useRouter();
  const { data: cats } = useLoad<Category[]>(loadCategories);

  const [form, setForm] = useState<ProductForm>(existing ? toForm(existing) : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setSaving(true);
    setErrors({});
    setFailure(null);
    try {
      const saved = existing
        ? await updateProduct(existing.id, form)
        : await createProduct(form);
      router.push(`/admin/products/${saved.id}/`);
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
    setUploading(true);
    setFailure(null);
    try {
      const { path } = await uploadMedia(file, "products", form.slug);
      set("imageSrc", path);
    } catch (e) {
      setFailure(message(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <Note kind="error">{failure}</Note>

      <div className="admin-card">
        <div className="grid2">
          <Field
            label="Название"
            error={errors.name}
            hint="Как изделие называется на карточке."
          >
            <input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>

          <Field
            label="Адрес в URL (slug)"
            error={errors.slug}
            hint={
              existing?.published
                ? "Изделие опубликовано: переименование отклонит портал."
                : "Латиница в нижнем регистре, цифры и дефис."
            }
          >
            <input
              aria-label="Адрес изделия (slug)"
              value={form.slug}
              disabled={existing?.published}
              onChange={(e) => set("slug", e.target.value)}
            />
          </Field>

          <Field label="Тип изделия" error={errors.kind} hint="Например: инкубатор-трансформер.">
            <input value={form.kind} onChange={(e) => set("kind", e.target.value)} />
          </Field>

          <Field
            label="Статус данных"
            error={errors.docStatus}
            hint="Подтверждены ли характеристики датащитом. Это не видимость на сайте."
          >
            <select value={form.docStatus} onChange={(e) => set("docStatus", e.target.value)}>
              {/* Без служебного кода в подписи: выбирающему он не нужен,
                  а в таблице та же вещь называется просто «по датащиту».
                  Значение при этом остаётся кодом — его ждёт портал. */}
              <option value="confirmed">по датащиту</option>
              <option value="pending">ожидает уточнения</option>
            </select>
          </Field>
        </div>

        <Field label="Короткое описание" error={errors.summary} hint="Показывается в списке.">
          <textarea value={form.summary} onChange={(e) => set("summary", e.target.value)} />
        </Field>

        <Field
          label="Развёрнутое описание"
          error={errors.detail}
          hint="Пусто — карточка покажет только короткое."
        >
          <textarea
            value={form.detail ?? ""}
            onChange={(e) => set("detail", e.target.value || null)}
            style={{ minHeight: 160 }}
          />
        </Field>

        <Field
          label="Назначение"
          error={errors.purpose}
          hint="В каких отделениях и для каких задач применяется изделие. Пусто — карточка покажет «ожидает уточнения»."
        >
          <textarea
            value={form.purpose ?? ""}
            onChange={(e) => set("purpose", e.target.value || null)}
            style={{ minHeight: 120 }}
          />
        </Field>

        <div className="grid2">
          <Field label="Порядок в списке" error={errors.sortOrder}>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
            />
          </Field>

          <Field label="Подпись к снимку" error={errors.imageAlt}>
            <input
              value={form.imageAlt ?? ""}
              onChange={(e) => set("imageAlt", e.target.value || null)}
            />
          </Field>
        </div>

        <Field
          label="Снимок"
          hint="Файл уезжает в открытый на чтение бакет. В базе хранится путь, а не адрес: имя хоста — свойство окружения."
        >
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </Field>
        {form.imageSrc && <p className="mono">{form.imageSrc}</p>}
      </div>

      <div className="admin-card">
        <h2 style={{ fontSize: "var(--t-base)", marginBottom: "var(--s3)" }}>Категории</h2>
        {!cats && <p className="muted">Загружаем…</p>}
        <div className="row">
          {cats?.map((c) => (
            <label key={c.id} className="field--row" style={{ marginRight: "var(--s4)" }}>
              <input
                type="checkbox"
                checked={form.categorySlugs.includes(c.slug)}
                onChange={(e) =>
                  set(
                    "categorySlugs",
                    e.target.checked
                      ? [...form.categorySlugs, c.slug]
                      : form.categorySlugs.filter((s) => s !== c.slug),
                  )
                }
              />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </div>

      <SpecTable
        title="Ключевые параметры"
        hint="Четыре строки под заголовком карточки."
        rows={form.keyParams}
        onChange={(rows) => set("keyParams", rows)}
      />

      <SpecTable
        title="Характеристики"
        hint="Таблица на вкладке изделия. Не выдумывать значения: неизвестное — «ожидает уточнения»."
        rows={form.specs}
        onChange={(rows) => set("specs", rows)}
      />

      <FeatureList rows={form.features} onChange={(rows) => set("features", rows)} />

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

// Отдельный список, а не SpecTable с пустым значением: у особенности нет пары
// «метка — значение», это одно утверждение. Второе поле ввода, всегда пустое,
// редактор бы заполнял — и не понимал, зачем.
function FeatureList({
  rows,
  onChange,
}: {
  rows: string[];
  onChange: (rows: string[]) => void;
}) {
  return (
    <div className="admin-card">
      <h2 style={{ fontSize: "var(--t-base)", marginBottom: "var(--s1)" }}>Ключевые особенности</h2>
      <p className="admin-hint" style={{ marginBottom: "var(--s3)" }}>
        По одному утверждению в строке, в порядке важности. Пусто — карточка покажет «ожидает
        уточнения».
      </p>

      {rows.map((row, i) => (
        <div key={i} className="row" style={{ marginBottom: "var(--s2)" }}>
          <input
            aria-label="Особенность изделия"
            className="admin-search" style={{ flex: "1 1 420px" }}
            placeholder="Например: переход между режимами без перекладывания новорождённого"
            value={row}
            onChange={(e) => onChange(rows.map((r, index) => (index === i ? e.target.value : r)))}
          />
          <button
            className="btn btn--small btn--danger"
            onClick={() => onChange(rows.filter((_, index) => index !== i))}
          >
            Удалить
          </button>
        </div>
      ))}

      <button className="btn btn--small" onClick={() => onChange([...rows, ""])}>
        Добавить особенность
      </button>
    </div>
  );
}

function SpecTable({
  title,
  hint,
  rows,
  onChange,
}: {
  title: string;
  hint: string;
  rows: Spec[];
  onChange: (rows: Spec[]) => void;
}) {
  const patch = (index: number, next: Partial<Spec>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...next } : row)));

  return (
    <div className="admin-card">
      <h2 style={{ fontSize: "var(--t-base)", marginBottom: "var(--s1)" }}>{title}</h2>
      <p className="admin-hint" style={{ marginBottom: "var(--s3)" }}>
        {hint}
      </p>

      {rows.map((row, i) => (
        <div key={i} className="row" style={{ marginBottom: "var(--s2)" }}>
          <input
            aria-label="Название параметра"
            className="admin-search" style={{ flex: "1 1 220px" }}
            placeholder="Название"
            value={row.label}
            onChange={(e) => patch(i, { label: e.target.value })}
          />
          <input
            aria-label="Значение параметра"
            className="admin-search" style={{ flex: "2 1 300px" }}
            placeholder="Значение"
            value={row.value}
            onChange={(e) => patch(i, { value: e.target.value })}
          />
          <label className="field--row" title="Приглушить: значение не подтверждено">
            <input
              type="checkbox"
              checked={row.muted}
              onChange={(e) => patch(i, { muted: e.target.checked })}
            />
            <span style={{ fontSize: "var(--t-small)" }}>приглушить</span>
          </label>
          <button
            className="btn btn--small btn--danger"
            onClick={() => onChange(rows.filter((_, index) => index !== i))}
          >
            Удалить
          </button>
        </div>
      ))}

      <button
        className="btn btn--small"
        onClick={() => onChange([...rows, { label: "", value: "", muted: false }])}
      >
        Добавить строку
      </button>
    </div>
  );
}

// Поля перечислены явно, а не отброшены деструктуризацией: список полей формы
// должен быть виден целиком, а неиспользуемые переменные из деструктуризации —
// это предупреждения линтера в обмен на две сэкономленные строки.
function toForm(product: Product): ProductForm {
  return {
    version: product.version,
    slug: product.slug,
    name: product.name,
    kind: product.kind,
    summary: product.summary,
    detail: product.detail,
    purpose: product.purpose,
    features: product.features,
    docStatus: product.docStatus,
    sortOrder: product.sortOrder,
    imageSrc: product.imageSrc,
    imageAlt: product.imageAlt,
    categorySlugs: product.categorySlugs,
    keyParams: product.keyParams,
    specs: product.specs,
  };
}
