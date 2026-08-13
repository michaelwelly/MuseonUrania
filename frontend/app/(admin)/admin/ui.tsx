"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminError } from "@/lib/admin";

// Мелочи, которые иначе повторялись бы на каждой странице админки.

/** Загрузка данных страницы: состояние, ошибка и перезагрузка после действия. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    load()
      .then((value) => {
        setData(value);
        setError(null);
      })
      .catch((e: unknown) => setError(message(e)))
      .finally(() => setLoading(false));
    // Список зависимостей приходит от вызывающего: он знает, от чего зависит
    // его запрос, а обобщённый хук — нет.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(reload, [reload]);

  return { data, error, loading, reload, setError };
}

export function message(e: unknown): string {
  if (e instanceof AdminError) return e.message;
  if (e instanceof Error) return e.message;
  return "Неизвестная ошибка";
}

export function fieldErrors(e: unknown): Record<string, string> {
  return e instanceof AdminError ? (e.fields ?? {}) : {};
}

export function Note({ kind, children }: { kind: "error" | "ok"; children: React.ReactNode }) {
  if (!children) return null;
  return <p className={`note note--${kind}`}>{children}</p>;
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`field${error ? " field--error" : ""}`}>
      <span>{label}</span>
      {children}
      {(error || hint) && <small>{error ?? hint}</small>}
    </label>
  );
}

export function Published({ on }: { on: boolean }) {
  return (
    <span className={`badge ${on ? "badge--on" : "badge--off"}`}>
      {on ? "опубликовано" : "черновик"}
    </span>
  );
}

/** Дата в московском виде. Сервер отдаёт ISO, разбор — забота интерфейса. */
export function when(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.valueOf())
    ? iso
    : date.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="admin-hint">{children}</p>;
}
