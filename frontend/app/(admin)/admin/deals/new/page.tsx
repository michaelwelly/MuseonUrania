"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  clients as loadClients,
  createDeal,
  pipelines as loadPipelines,
  type ClientRow,
  type NewDeal,
  type Page,
  type Pipeline,
} from "@/lib/admin";
import { PIPELINE, label } from "../../labels";
import { Field, Note, fieldErrors, message, useLoad } from "../../ui";
import OwnerField from "../../OwnerField";

// Сделка заводится по уже существующему клиенту. Сделка из заявки заводится
// другой дверью — разбором на странице заявок: там вместе со сделкой
// заводится и карточка клиента, и связь заявки со сделкой.

export default function NewDealPage() {
  return (
    <Suspense fallback={<p className="muted">Загружаем…</p>}>
      <NewDealForm />
    </Suspense>
  );
}

function NewDealForm() {
  const router = useRouter();
  const preselected = useSearchParams().get("client") ?? "";

  const { data: funnels } = useLoad<Pipeline[]>(loadPipelines);

  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const { data: found } = useLoad<Page<ClientRow>>(() => loadClients(query, 0, 20), query);

  const [form, setForm] = useState<NewDeal>({
    clientId: preselected,
    pipeline: "sales",
    title: "",
    amount: null,
    currency: "RUB",
    productSlug: "",
    owner: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof NewDeal>(key: K, value: NewDeal[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const chosen = found?.items.find((c) => c.id === form.clientId);

  async function save() {
    setSaving(true);
    setErrors({});
    setFailure(null);
    try {
      const saved = await createDeal(form);
      router.push(`/admin/deals/${saved.id}/`);
    } catch (e) {
      setErrors(fieldErrors(e));
      setFailure(message(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Новая сделка</h1>
      </div>
      <p className="admin-hint">
        Воронка выбирается один раз и потом не меняется: сделка, переехавшая из продаж
        в сервис, — это две разные сделки, а не одна с другой стадией.
      </p>

      <Note kind="error">{failure}</Note>

      <div className="admin-card">
        <Field
          label="Клиент"
          error={errors.clientId}
          hint="Найдите по наименованию или ИНН. Клиента без карточки завести нельзя."
        >
          <div className="row">
            <input
              className="admin-search"
              value={typed}
              placeholder="Наименование или ИНН"
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setQuery(typed.trim())}
            />
            <button className="btn" onClick={() => setQuery(typed.trim())}>
              Найти
            </button>
          </div>
        </Field>

        {found && found.items.length > 0 && (
          <div className="picker">
            {found.items.map((c) => (
              <label key={c.id} className="picker__row">
                <input
                  type="radio"
                  name="client"
                  checked={form.clientId === c.id}
                  onChange={() => set("clientId", c.id)}
                />
                <span>
                  {c.name}
                  {c.inn && <span className="mono"> · {c.inn}</span>}
                  {c.city && <span className="muted"> · {c.city}</span>}
                </span>
              </label>
            ))}
          </div>
        )}

        {form.clientId && !chosen && (
          <p className="admin-hint">
            Клиент выбран заранее. Найдите его в списке, если хотите проверить, тот ли это.
          </p>
        )}

        <div className="grid2">
          <Field label="Воронка" error={errors.pipeline}>
            <select value={form.pipeline} onChange={(e) => set("pipeline", e.target.value)}>
              {(funnels ?? []).map((f) => (
                <option key={f.pipeline} value={f.pipeline}>
                  {label(PIPELINE, f.pipeline)}
                </option>
              ))}
            </select>
          </Field>

          <OwnerField value={form.owner} onChange={(login) => set("owner", login)} />
        </div>

        <Field label="Название" error={errors.title} hint="Например: поставка двух систем VEDAL R2.">
          <input value={form.title} onChange={(e) => set("title", e.target.value)} />
        </Field>

        <div className="grid2">
          <Field label="Сумма" error={errors.amount} hint="Пусто — сумма ещё не названа.">
            <input
              type="number"
              value={form.amount ?? ""}
              onChange={(e) => set("amount", e.target.value === "" ? null : Number(e.target.value))}
            />
          </Field>

          <Field label="Валюта" error={errors.currency} hint="Три заглавные буквы.">
            <input value={form.currency} onChange={(e) => set("currency", e.target.value)} />
          </Field>
        </div>

        <Field
          label="Изделие"
          error={errors.productSlug}
          hint="Адрес позиции каталога. Пусто, если сделка не про одно изделие."
        >
          <input value={form.productSlug} onChange={(e) => set("productSlug", e.target.value)} />
        </Field>
      </div>

      <div className="row row--end">
        <button className="btn" onClick={() => router.back()}>
          Отмена
        </button>
        <button
          className="btn btn--primary"
          disabled={saving || !form.clientId || !form.title.trim()}
          onClick={() => void save()}
        >
          {saving ? "Заводим…" : "Завести сделку"}
        </button>
      </div>
    </>
  );
}
