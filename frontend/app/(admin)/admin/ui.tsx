"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminError } from "@/lib/admin";

// Мелочи, которые иначе повторялись бы на каждой странице админки.

/**
 * Загрузка данных страницы: состояние, ошибка и перезагрузка после действия.
 *
 * Второй параметр — ключ запроса, а не список зависимостей. Список пришлось бы
 * передавать переменной, а React требует статический литерал: на переменной
 * ломается и правило хука, и мемоизация в компиляторе. Ключ склеивается
 * вызывающим из того, от чего зависит его запрос, — строка сравнивается
 * по значению, и лишних перезагрузок не будет.
 */
export function useLoad<T>(load: () => Promise<T>, key: string = "") {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  // Ошибка действия (сохранил, опубликовал, удалил) живёт отдельно от ошибки
  // загрузки: перезагрузка списка не должна стирать сообщение о том, почему
  // не сохранилось.
  const [actionError, setActionError] = useState<string | null>(null);

  // Что именно сейчас загружено. Строка, а не флаг: по ней видно, свежий
  // ли результат, и `loading` становится вычисляемым. Менять состояние
  // синхронно внутри эффекта нельзя — это лишний каскад рендеров.
  const token = `${key}#${attempt}`;

  useEffect(() => {
    // Ответ на запрос отменённой страницы приходить может, а обновлять
    // состояние снятого компонента — нет.
    let alive = true;

    load()
      .then((data) => alive && setResult({ token, data, error: null }))
      .catch((e: unknown) => alive && setResult({ token, data: null, error: message(e) }));

    return () => {
      alive = false;
    };
    // load пересоздаётся на каждом рендере, и в зависимостях ему не место:
    // эффект ушёл бы в бесконечный цикл. Всё, от чего он на самом деле
    // зависит, вызывающий склеивает в key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const reload = useCallback(() => setAttempt((a) => a + 1), []);
  const setError = useCallback((value: string | null) => setActionError(value), []);

  return {
    // Прошлые данные остаются на экране, пока едут новые: иначе список
    // мигает пустотой на каждом обновлении после действия.
    data: result?.data ?? null,
    error: actionError ?? result?.error ?? null,
    loading: result?.token !== token,
    reload,
    setError,
  };
}

type Result<T> = { token: string; data: T | null; error: string | null };

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

/** Дата в местном виде. Сервер отдаёт ISO, разбор — забота интерфейса. */
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
