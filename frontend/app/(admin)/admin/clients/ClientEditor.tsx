"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createClient,
  updateClient,
  type Client,
  type ClientForm,
} from "@/lib/admin";
import { Field, Note, fieldErrors, isConflict, message } from "../ui";
import OwnerField from "../OwnerField";

// Карточка клиента. Одна форма на создание и на правку: поля и правила
// у них общие, разница — куда уходит сохранение.
//
// ИНН и КПП проверяет портал (10 или 12 цифр и 9 цифр), здесь они обычные
// поля: продублировать проверку значит однажды разойтись с ней.

const EMPTY: ClientForm = {
  version: null,
  name: "",
  kind: "company",
  inn: "",
  kpp: "",
  externalId: "",
  country: "Россия",
  city: "",
  email: "",
  phone: "",
  note: "",
  owner: "",
};

export default function ClientEditor({
  existing,
  kinds,
  onSaved,
}: {
  existing?: Client;
  kinds: string[];
  /** Карточка после сохранения: вызывающий обновляет заголовок и историю. */
  onSaved?: (client: Client) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ClientForm>(existing ? toForm(existing) : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ClientForm>(key: K, value: ClientForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setSaving(true);
    setErrors({});
    setFailure(null);
    setConflict(false);
    try {
      if (existing) {
        const saved = await updateClient(existing.id, form);
        // Версия сдвинулась — забрать её из ответа обязательно. Оставить
        // старую значит получить 409 на втором сохранении подряд, хотя
        // карточку никто, кроме этого же редактора, не трогал.
        setForm(toForm(saved));
        onSaved?.(saved);
      } else {
        const saved = await createClient(form);
        router.push(`/admin/clients/${saved.id}/`);
      }
    } catch (e) {
      setErrors(fieldErrors(e));
      if (isConflict(e)) setConflict(true);
      setFailure(message(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {conflict ? (
        <Note kind="error">
          {failure} Карточку успел поправить кто-то ещё, и вашей правки в ней нет. Перечитайте
          карточку и внесите изменения заново — сохранить поверх значит затереть чужую работу
          вслепую.{" "}
          <button className="btn btn--small" onClick={() => window.location.reload()}>
            Перечитать
          </button>
        </Note>
      ) : (
        <Note kind="error">{failure}</Note>
      )}

      <div className="admin-card">
        <div className="grid2">
          <Field
            label="Наименование"
            error={errors.name}
            hint="Организация или ФИО, как в договоре."
          >
            <input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>

          <Field label="Вид" error={errors.kind}>
            <select value={form.kind} onChange={(e) => set("kind", e.target.value)}>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {k === "company" ? "организация" : "человек"}
                </option>
              ))}
            </select>
          </Field>

          <Field label="ИНН" error={errors.inn} hint="10 цифр у организации, 12 у предпринимателя.">
            <input value={form.inn} onChange={(e) => set("inn", e.target.value)} />
          </Field>

          <Field label="КПП" error={errors.kpp} hint="9 цифр.">
            <input value={form.kpp} onChange={(e) => set("kpp", e.target.value)} />
          </Field>

          <Field label="Страна" error={errors.country}>
            <input value={form.country} onChange={(e) => set("country", e.target.value)} />
          </Field>

          <Field label="Город" error={errors.city}>
            <input value={form.city} onChange={(e) => set("city", e.target.value)} />
          </Field>

          <Field label="Почта" error={errors.email}>
            <input value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>

          <Field label="Телефон" error={errors.phone}>
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>

          <OwnerField value={form.owner} onChange={(login) => set("owner", login)} />

          <Field
            label="Идентификатор в 1С"
            error={errors.externalId}
            hint="Поле заведено под будущий обмен. Самого обмена нет."
          >
            <input value={form.externalId} onChange={(e) => set("externalId", e.target.value)} />
          </Field>
        </div>

        <Field label="Заметка" error={errors.note} hint="Для своих. Клиенту не показывается.">
          <textarea value={form.note} onChange={(e) => set("note", e.target.value)} />
        </Field>
      </div>

      <div className="row row--end">
        <button className="btn" onClick={() => router.back()}>
          Отмена
        </button>
        <button
          className="btn btn--primary"
          disabled={saving || conflict}
          onClick={() => void save()}
        >
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </>
  );
}

// Поля перечислены явно: список того, что уходит в портал, должен быть
// виден целиком. Пустое поле — "", а не null: портал принимает "" везде,
// где допускает пустое значение.
function toForm(client: Client): ClientForm {
  return {
    version: client.version,
    name: client.name,
    kind: client.kind,
    inn: client.inn ?? "",
    kpp: client.kpp ?? "",
    externalId: client.externalId ?? "",
    country: client.country ?? "",
    city: client.city ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    note: client.note ?? "",
    owner: client.owner ?? "",
  };
}
