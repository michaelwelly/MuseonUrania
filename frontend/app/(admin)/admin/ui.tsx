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

/**
 * Отказ по версии.
 *
 * От остальных ошибок отличается тем, что делать редактору: не «повторите»,
 * а «перечитайте карточку, вашей правки в ней нет». Показать 409 как общую
 * неудачу значит предложить нажать «Сохранить» ещё раз — а он снова не
 * сохранит, и так до тех пор, пока человек не решит, что портал сломан.
 */
export function isConflict(e: unknown): boolean {
  return e instanceof AdminError && e.status === 409;
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

/*
 * Состояние рабочего процесса: заявка, КП, стадия сделки.
 *
 * Отдельно от Published, потому что это разные оси. Published отвечает
 * на вопрос «видно ли это на сайте» — там два значения и никакой тревоги.
 * Здесь — где вещь стоит в работе, и таких значений двенадцать на три
 * воронки, но состояний у них ровно три: исход достигнут, идёт работа,
 * отказ.
 *
 * Раньше статусы рисовались нейтральной меткой — той же, что воронка,
 * рубрика новости и форма заявки. Интерфейс не отличал «это ярлык»
 * от «это состояние», и «проиграна» выглядела как «сервис».
 *
 * Сведение живёт здесь, а не в каждой странице: четвёртая воронка добавит
 * стадии, и разъехаться они должны в одном месте, а не в шести.
 */
const ДОСТИГНУТО = new Set(["won", "accepted", "active", "closed"]);
const ОТКАЗ = new Set(["lost", "rejected", "expired", "declined"]);

export function State({ value, dict }: { value: string; dict: Record<string, string> }) {
  const tone = ДОСТИГНУТО.has(value) ? "on" : ОТКАЗ.has(value) ? "stop" : "warn";
  return <span className={`badge badge--${tone}`}>{dict[value] ?? value}</span>;
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

/** Дата без времени: портал отдаёт `YYYY-MM-DD`, разбирать её как момент незачем. */
export function day(value: string | null): string {
  if (!value) return "—";
  const [year, month, date] = value.split("-");
  return date ? `${date}.${month}.${year}` : value;
}

/**
 * Сумма с валютой.
 *
 * Разряды разделяются, копейки показываются всегда: «2650000» и «2 650 000,00 ₽»
 * читаются по-разному, и в КП это разница между «два с половиной миллиона»
 * и «двадцать шесть миллионов».
 */
export function money(amount: number | null, currency: string | null): string {
  if (amount === null || amount === undefined) return "—";
  const shown = amount.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${shown} ${currency}` : shown;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="admin-hint">{children}</p>;
}

/**
 * Выбор одного из немногих: статус заявки, воронка, валюта, разрез аналитики.
 *
 * Сегменты, а не выпадающий список, ровно там, где вариантов от двух до пяти
 * и все они помещаются в строку. Причина не в красоте: выпадающий список
 * прячет варианты за щелчком, и человек, который не помнит, что там,
 * открывает его просто чтобы посмотреть. На пяти статусах заявки это
 * лишний щелчок в каждом разборе.
 *
 * Больше пяти вариантов — обратно в select: сегменты начинают переноситься
 * и превращаются в облако кнопок, где текущий теряется.
 *
 * Кнопки, а не радиокнопки со своей разметкой: группе нужно имя целиком
 * (`role="radiogroup"` с подписью), а каждой кнопке — состояние, которое
 * читается вслух. `aria-checked` на кнопке делает и то, и другое.
 */
export function Segments({
  label: name,
  value,
  options,
  dict,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  /** Как называть значения по-человечески. Без словаря — как есть. */
  dict?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="segments" role="radiogroup" aria-label={name}>
      {options.map((option) => {
        const on = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={on}
            className={`segments__one${on ? " segments__one--on" : ""}`}
            onClick={() => onChange(option)}
          >
            {dict ? (dict[option] ?? option) : option}
          </button>
        );
      })}
    </div>
  );
}
