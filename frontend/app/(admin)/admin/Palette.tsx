"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clients, deals, news, products } from "@/lib/admin";
import { slugify } from "@/lib/translit";
import { SearchIcon } from "./icons";

// Поиск по всему порталу.
//
// Задача, которую он снимает: «нет поиска по всему» — одна из шести жалоб
// заказчика. До него найти клиента можно было, только вспомнив, в каком он
// разделе, открыв раздел и отфильтровав список. Три перехода на вопрос
// «как звали того из Казани».
//
// ───────────────────────────────────────────────────────────────────────────
// Откуда берутся строки
//
// Клиенты ищутся на портале: `clients(query)` — единственная дверь с поиском,
// и клиентов больше всего. Каталог, новости и сделки отдаются списком целиком
// (тринадцать, ноль и девятнадцать записей), и перебрать их в браузере дешевле
// одного запроса.
//
// Документов здесь пока нет намеренно. У документа нет своего адреса в
// админке — правка идёт строкой в списке, — и найденная строка вела бы
// в список без указания, какую из тридцати строк человек искал. Появится
// адрес — появится и группа; обещать переход, который не сбывается, хуже,
// чем не искать вовсе.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему окно живёт только пока открыто
//
// Оболочка рисует его по флагу, а не прячет стилями, и всё состояние —
// набранное, курсор, прочитанные списки — заводится заново при каждом
// открытии. Иначе пришлось бы сбрасывать его руками на открытии, а сброс
// «руками» — это ровно то место, где однажды забудут одно поле из трёх,
// и человек, нажавший ⌘K, увидит вчерашний запрос с чужим курсором.
//
// Списки при этом читаются один раз за открытие: каталог и сделки
// не меняются между двумя нажатиями стрелки, а перечитывать их на каждую
// букву — это запрос на символ.

type Row = {
  kind: string;
  title: string;
  note: string;
  href: string;
  /** Подсказка справа: клавиша у действия, вид записи у находки. */
  hint?: string;
  /** Действие и переход — не находки: вид записи у них приглушён. */
  act?: true;
};

/** Найденное вместе с запросом, к которому оно относится. */
type Находки = { q: string; rows: Row[] };

export function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pool, setPool] = useState<Row[] | null>(null);
  const [found, setFound] = useState<Находки>({ q: "", rows: [] });
  const [cursor, setCursor] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  const listId = useId();
  const трим = query.trim();

  // Списки, которые перебираются в браузере. Один раз за открытие окна.
  useEffect(() => {
    let alive = true;

    void Promise.allSettled([products(), news(), deals({}, 0, 100)]).then(
      ([каталог, лента, сделки]) => {
        if (!alive) return;
        const rows: Row[] = [];

        if (каталог.status === "fulfilled") {
          for (const item of каталог.value) {
            rows.push({
              kind: "изделие",
              title: item.name,
              note: item.slug,
              href: `/admin/products/${item.id}`,
            });
          }
        }

        if (лента.status === "fulfilled") {
          for (const item of лента.value) {
            rows.push({
              kind: "новость",
              title: item.title,
              note: item.slug,
              href: `/admin/news/${item.id}`,
            });
          }
        }

        if (сделки.status === "fulfilled") {
          for (const item of сделки.value.items) {
            rows.push({
              kind: "сделка",
              title: item.title,
              note: item.clientName,
              href: `/admin/deals/${item.id}`,
            });
          }
        }

        setPool(rows);
      },
    );

    return () => {
      alive = false;
    };
  }, []);

  // Фокус в поле сразу: окно открыли, чтобы печатать.
  useEffect(() => field.current?.focus(), []);

  // Клиенты — запросом к порталу, с выдержкой.
  //
  // Выдержка не украшение: без неё «Кольцова» это восемь запросов, семь из
  // которых устареют раньше, чем вернутся.
  //
  // Найденное хранится вместе с запросом, а не отдельно. Так устаревший ответ
  // отсеивается сам: показывается только то, что относится к набранному
  // прямо сейчас. Сбрасывать список на каждую букву при этом не нужно —
  // а именно сброс и оставлял на экране чужие строки на те доли секунды,
  // пока едет новый ответ.
  useEffect(() => {
    if (трим.length < 2) return;

    let alive = true;
    const timer = setTimeout(() => {
      void clients(трим, 0, 6)
        .then((page) => {
          if (!alive) return;
          setFound({
            q: трим,
            rows: page.items.map((c) => ({
              kind: "клиент",
              title: c.name,
              note: c.inn ? `ИНН ${c.inn}` : (c.city ?? "без ИНН"),
              href: `/admin/clients/${c.id}`,
            })),
          });
        })
        .catch(() => alive && setFound({ q: трим, rows: [] }));
    }, 200);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [трим]);

  const строки = useMemo(() => {
    const низ = трим.toLowerCase();
    // Каталог назван латиницей — VEDAL R1, — а ищут его по-русски: «вед».
    // Замер на стенде: «вед» не находил ничего, «ved» находил восемь
    // изделий. Поэтому набранное сравнивается ещё и в транслитерации
    // тем же правилом, которым собираются адреса страниц.
    const латиницей = slugify(трим);
    const совпало = (текст: string) => {
      const t = текст.toLowerCase();
      return t.includes(низ) || (латиницей.length > 1 && t.includes(латиницей));
    };
    const из_пула = низ ? (pool ?? []).filter((r) => совпало(r.title) || совпало(r.note)) : [];
    const клиенты = found.q === трим ? found.rows : [];
    const подходящие = низ ? ДЕЙСТВИЯ.filter((r) => совпало(r.title)) : ДЕЙСТВИЯ;

    // Клиенты первыми: их ищут чаще всего, и ждать их появления после
    // каталога значит смотреть, как строка под курсором прыгает.
    return { найдено: [...клиенты, ...из_пула].slice(0, 8), действия: подходящие };
  }, [трим, pool, found]);

  const всё = useMemo(
    () => [...строки.найдено, ...строки.действия],
    [строки.найдено, строки.действия],
  );

  const перейти = (row: Row | undefined) => {
    if (!row) return;
    onClose();
    router.push(row.href);
  };

  const клавиша = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || (e.key === "n" && e.ctrlKey)) {
      e.preventDefault();
      setCursor((c) => (всё.length === 0 ? 0 : (c + 1) % всё.length));
      return;
    }
    if (e.key === "ArrowUp" || (e.key === "p" && e.ctrlKey)) {
      e.preventDefault();
      setCursor((c) => (всё.length === 0 ? 0 : (c - 1 + всё.length) % всё.length));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      перейти(всё[cursor]);
    }
  };

  // Курсор мог остаться на пятой строке списка, в котором теперь две:
  // набранное поменялось раньше, чем приехал ответ. Правится при чтении,
  // а не сбросом в эффекте — лишний проход отрисовки того не стоит.
  const под_курсором = всё.length === 0 ? 0 : Math.min(cursor, всё.length - 1);

  const строка = (row: Row, index: number) => (
    <button
      key={`${row.kind}-${row.href}-${row.title}`}
      type="button"
      id={`${listId}-${index}`}
      role="option"
      aria-selected={index === под_курсором}
      className={`palette__row${index === под_курсором ? " palette__row--on" : ""}`}
      // Наведение двигает курсор: иначе мышь подсвечивает одну строку,
      // а Enter открывает другую.
      onMouseMove={() => setCursor(index)}
      onClick={() => перейти(row)}
    >
      <span className={`palette__kind${row.act ? " palette__kind--act" : ""}`}>{row.kind}</span>
      <span className="palette__title">{row.title}</span>
      <span className="palette__note mono">{row.hint ?? row.note}</span>
    </button>
  );

  return (
    <div
      className="veil veil--top"
      onMouseDown={(e) => {
        // Именно mousedown по самому затемнению: click срабатывает и когда
        // выделение текста началось внутри окна, а кончилось снаружи.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Поиск по всему порталу"
        onKeyDown={клавиша}
      >
        <div className="palette__head">
          <SearchIcon size={18} />
          <input
            ref={field}
            className="palette__field"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            placeholder="Клиент, сделка, изделие, материал"
            aria-label="Что искать"
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={всё.length > 0 ? `${listId}-${под_курсором}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <span className="palette__esc mono">ESC — закрыть</span>
        </div>

        <div className="palette__body" id={listId} role="listbox" aria-label="Что нашлось">
          {строки.найдено.length > 0 && (
            <>
              <p className="palette__group mono">Найдено</p>
              {строки.найдено.map((row, i) => строка(row, i))}
            </>
          )}

          {строки.действия.length > 0 && (
            <>
              <p className="palette__group mono">Действия</p>
              {строки.действия.map((row, i) => строка(row, строки.найдено.length + i))}
            </>
          )}

          {всё.length === 0 && (
            <p className="palette__none">
              {трим.length < 2
                ? "Наберите хотя бы две буквы."
                : "Ничего не нашлось. Поиск идёт по клиентам, сделкам, изделиям и новостям."}
            </p>
          )}
        </div>

        <p className="palette__foot mono">
          ↑ ↓ — выбрать · ⏎ — открыть · документы пока не ищутся: у них нет своего адреса
        </p>
      </div>
    </div>
  );
}

/** Действия — то же, что в окне горячих клавиш, и подписаны теми же клавишами. */
const ДЕЙСТВИЯ: Row[] = [
  {
    kind: "действие",
    title: "Новая сделка",
    note: "",
    href: "/admin/deals/new",
    hint: "N",
    act: true,
  },
  {
    kind: "действие",
    title: "Добавить материал",
    note: "",
    href: "/admin/news/new",
    hint: "D",
    act: true,
  },
  { kind: "действие", title: "Новый клиент", note: "", href: "/admin/clients/new", act: true },
  {
    kind: "переход",
    title: "Клиенты",
    note: "",
    href: "/admin/clients/",
    hint: "G затем C",
    act: true,
  },
  {
    kind: "переход",
    title: "Заявки",
    note: "",
    href: "/admin/leads/",
    hint: "G затем L",
    act: true,
  },
  {
    kind: "переход",
    title: "Сделки",
    note: "",
    href: "/admin/deals/",
    hint: "G затем D",
    act: true,
  },
];
