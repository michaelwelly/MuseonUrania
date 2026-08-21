"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloseIcon } from "./icons";

// Механика списков: выделение, массовые действия, выбор колонок, память
// о настройках сотрудника.
//
// Живёт отдельно от страниц, потому что одно и то же нужно заявкам,
// продукции, новостям и документам. Четыре реализации выделения — это четыре
// места, где по-разному поведёт себя SHIFT+КЛИК, и четыре разных ответа на
// вопрос, что происходит с выделением при смене страницы.

// ───────────────────────────────────────────────────────────────────────────
// Память о настройках

/**
 * Настройка, которая помнится за сотрудником: выбор колонок, сохранённые
 * фильтры.
 *
 * Живёт в localStorage, а не на портале, и это осознанно: портал такого
 * не хранит, а заводить под выбор колонок таблицу и дверь — несоразмерно.
 * Плата известна и невелика: настройка не переезжает на другой браузер.
 *
 * Читается один раз при заведении состояния, а не эффектом следом.
 * Эффект дал бы лишний проход отрисовки — сначала колонки по умолчанию,
 * потом сохранённые, — и таблица заметно перекладывалась бы на глазах.
 *
 * Расхождения с разметкой сервера это не вызывает, хотя обычно вызвало бы:
 * страницы админки рисуются только после того, как портал принял токен,
 * то есть уже в браузере. До этого оболочка показывает экран проверки,
 * и ни один список не смонтирован. Проверка на `window` оставлена всё
 * равно — на случай, если когда-нибудь окажется иначе.
 */
export function useStored<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      // Испорченная запись — не повод не открыть страницу.
      return initial;
    }
  });

  const store = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Хранилище переполнено или запрещено настройками браузера.
        // Настройка проживёт до перезагрузки — это лучше, чем отказ.
      }
    },
    [key],
  );

  return [value, store];
}

// ───────────────────────────────────────────────────────────────────────────
// Выделение строк

export type Selection = {
  /** Выделенные строки, только те, что есть на текущей странице. */
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  /** SHIFT+КЛИК: от последней нажатой строки до этой включительно. */
  range: (id: string) => void;
  all: () => void;
  clear: () => void;
  /** Выделено не всё и не ничего — флажок в шапке рисует тире. */
  partial: boolean;
};

/**
 * Выделение строк списка.
 *
 * Выделение хранится множеством идентификаторов, но наружу отдаётся
 * пересечённым с тем, что сейчас на экране. Иначе «выбрано 3» на второй
 * странице означает три заявки, которых на ней нет, а массовое действие
 * применяется к невидимому.
 *
 * SHIFT+КЛИК считает диапазон по порядку строк на экране, а не по порядку
 * нажатий: человек выделяет то, что видит между двумя строками.
 */
export function useSelection(rows: readonly string[]): Selection {
  const [picked, setPicked] = useState<readonly string[]>([]);
  const anchor = useRef<string | null>(null);

  const ids = useMemo(() => rows.filter((id) => picked.includes(id)), [rows, picked]);

  const toggle = useCallback((id: string) => {
    anchor.current = id;
    setPicked((was) => (was.includes(id) ? was.filter((x) => x !== id) : [...was, id]));
  }, []);

  const range = useCallback(
    (id: string) => {
      const from = anchor.current;
      // Первый SHIFT+КЛИК без предыдущего нажатия — это обычный щелчок:
      // диапазон не от чего считать.
      if (from === null) {
        toggle(id);
        return;
      }
      const a = rows.indexOf(from);
      const b = rows.indexOf(id);
      if (a < 0 || b < 0) {
        toggle(id);
        return;
      }
      const кусок = rows.slice(Math.min(a, b), Math.max(a, b) + 1);
      setPicked((was) => [...new Set([...was, ...кусок])]);
      anchor.current = id;
    },
    [rows, toggle],
  );

  const all = useCallback(() => {
    setPicked((was) => [...new Set([...was, ...rows])]);
  }, [rows]);

  const clear = useCallback(() => {
    anchor.current = null;
    setPicked([]);
  }, []);

  return {
    ids,
    has: (id) => ids.includes(id),
    toggle,
    range,
    all,
    clear,
    partial: ids.length > 0 && ids.length < rows.length,
  };
}

/** Флажок в шапке таблицы: выбрать всё, снять всё, тире у половины. */
export function HeadBox({
  selection,
  rows,
  what,
}: {
  selection: Selection;
  rows: readonly string[];
  what: string;
}) {
  const box = useRef<HTMLInputElement>(null);
  const все = rows.length > 0 && selection.ids.length === rows.length;

  // Промежуточное состояние ставится только из кода — атрибута разметки
  // у него нет. Без него флажок при половине выделенных выглядит снятым,
  // и нажатие «выбрать всё» читается как «снять всё».
  useEffect(() => {
    if (box.current) box.current.indeterminate = selection.partial;
  }, [selection.partial]);

  return (
    <input
      ref={box}
      type="checkbox"
      checked={все}
      onChange={() => (все ? selection.clear() : selection.all())}
      aria-label={все ? `Снять выделение: ${what}` : `Выбрать всё: ${what}`}
    />
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Полоса массовых действий

/**
 * Появляется при первом выделении и заменяет собой панель действий.
 *
 * Действия не спрятаны в меню: массовое действие — это то, ради чего
 * выделяли, и лишний щелчок здесь стоит дороже, чем экономия места.
 */
export function BulkBar({
  count,
  what,
  onClear,
  children,
}: {
  count: number;
  /** «Выбрано 3 заявки» — слово склоняется вызывающим. */
  what: string;
  onClear: () => void;
  children: React.ReactNode;
}) {
  if (count === 0) return null;

  return (
    <div className="bulk" role="region" aria-label="Действия над выделенным">
      <span className="bulk__count">
        Выбрано {count} {what}
      </span>
      <div className="bulk__actions">{children}</div>
      <button type="button" className="bulk__clear" onClick={onClear}>
        Снять выделение
      </button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Выбор колонок

export type Column = { key: string; label: string };

/**
 * Кнопка «Колонки» с панелью флажков.
 *
 * Выключенная колонка действительно уходит из таблицы, а не прячется
 * стилями: смысл в том, чтобы на экран влезли те колонки, ради которых
 * человек сюда пришёл, а спрятанная стилями колонка продолжает занимать
 * место в раскладке.
 */
export function Columns({
  columns,
  shown,
  onChange,
}: {
  columns: readonly Column[];
  shown: readonly string[];
  onChange: (keys: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const мимо = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", мимо);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", мимо);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div className="cols" ref={box}>
      <button
        type="button"
        className="btn btn--small"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Колонки
      </button>

      {open && (
        <div className="cols__panel" role="dialog" aria-label="Какие колонки показывать">
          <div className="cols__head">
            <span className="cols__title mono">Колонки</span>
            <button
              type="button"
              className="cols__close"
              onClick={() => setOpen(false)}
              aria-label="Закрыть"
            >
              <CloseIcon size={14} />
            </button>
          </div>

          {columns.map((column) => (
            <label key={column.key} className="cols__row">
              <input
                type="checkbox"
                checked={shown.includes(column.key)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...shown, column.key]
                      : shown.filter((k) => k !== column.key),
                  )
                }
              />
              <span>{column.label}</span>
            </label>
          ))}

          <p className="cols__note">Выбор помнится за вами в этом браузере.</p>
        </div>
      )}
    </div>
  );
}
