"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  NOBODY,
  leadStatuses,
  leads,
  triageLead,
  type LeadFilter,
  type LeadRow,
  type Page,
} from "@/lib/admin";
import { plural } from "@/lib/plural";
import OwnerField from "../OwnerField";
import { useToast } from "../Toast";
import { useCounts } from "../counts";
import { SearchIcon } from "../icons";
import { FORM, LEAD_SOURCE, LEAD_STATUS, label } from "../labels";
import { BulkBar, Columns, HeadBox, useSelection, useStored, type Column } from "../lists";
import { Empty, Note, Segments, State, message, useLoad, when } from "../ui";
import { useWho } from "../who";
import { Triage } from "./Triage";

// Заявки.
//
// Единственная страница админки, где на экране персональные данные, и самая
// нагруженная работой: сюда приходят разбирать, а не смотреть. Отсюда всё
// остальное устройство экрана.
//
// ───────────────────────────────────────────────────────────────────────────
// Отбор делает портал
//
// Поиск и фильтры уходят в запрос, а не отбирают загруженную страницу.
// Разница видна не сразу и оттого опасна: отбор в браузере работает по
// пятидесяти строкам из скольких угодно и со второй страницы молча врёт —
// «ничего не найдено» там означает «на этой странице нет». Менеджер, ищущий
// человека по телефону, которым тот только что звонил, получил бы ответ
// про несуществующего клиента.
//
// ───────────────────────────────────────────────────────────────────────────
// Сохранённые фильтры
//
// Пять готовых наборов — это не украшение и не «избранное». Каждый отвечает
// на вопрос, с которого начинается рабочий день: что никто не ведёт, что моё,
// что новое. Счётчик рядом отвечает на них, не открывая.
//
// Живут в браузере: портал такого не хранит, а заводить под них таблицу
// и дверь несоразмерно. Плата известна — на другом компьютере своих
// фильтров не будет.

type Saved = {
  id: string;
  name: string;
  filter: LeadFilter;
  /** Готовые набраны здесь, свои — сотрудником. Удалять можно только свои. */
  own?: true;
};

const ВСЕ: Saved = { id: "all", name: "Все", filter: {} };

const КОЛОНКИ: readonly Column[] = [
  { key: "form", label: "Форма" },
  { key: "contacts", label: "Контакты" },
  { key: "source", label: "Источник" },
  { key: "owner", label: "Ответственный" },
];

const ПО_УМОЛЧАНИЮ = ["form", "contacts", "source", "owner"];

// Заявки одного человека адресуемы: `/admin/leads/?owner=irina`.
//
// Понадобилось карточке сотрудника и профилю — там число заявок стоит
// рядом с человеком, и щёлкнуть по нему должно быть можно. Польза шире:
// «посмотри, что на Антоне» перестало означать «открой заявки и вспомни,
// как его логин».
//
// Suspense обязателен: без границы useSearchParams уводит страницу
// в отрисовку на клиенте целиком, и сборка об этом предупреждает.
export default function LeadsPage() {
  return (
    <Suspense fallback={<p className="muted">Загружаем…</p>}>
      <Leads />
    </Suspense>
  );
}

function Leads() {
  const who = useWho();
  const asked = useSearchParams().get("owner");
  const toast = useToast();
  const counts = useCounts();

  const [saved, setSaved] = useStored<Saved[]>("vedal.admin.leads.filters", []);
  const [shown, setShown] = useStored<string[]>("vedal.admin.leads.columns", ПО_УМОЛЧАНИЮ);

  const готовые = useMemo<Saved[]>(
    () => [
      ВСЕ,
      { id: "nobody", name: "Без ответственного", filter: { owner: NOBODY } },
      { id: "mine", name: "Мои в работе", filter: { owner: who.actor, status: "in_progress" } },
      { id: "new", name: "Новые", filter: { status: "new" } },
      { id: "quote", name: "Запросы КП", filter: { form: "quote" } },
    ],
    [who.actor],
  );

  const чипы = useMemo(() => {
    const все = [...готовые, ...saved];
    // Отбор, пришедший адресом, встаёт в полосу первым: без него
    // выбранного фильтра в полосе нет вовсе, и человек не понимает,
    // почему список короче обычного.
    if (asked && !все.some((c) => c.filter.owner === asked)) {
      все.unshift({
        id: `owner-${asked}`,
        name: `Заявки: ${asked}`,
        filter: { owner: asked },
      });
    }
    return все;
  }, [готовые, saved, asked]);

  // Отбор из адреса — только начальное значение: дальше выбор ведёт
  // состояние, иначе щелчок по чипу спорил бы с адресом в строке браузера.
  const [current, setCurrent] = useState<Saved>(() =>
    asked
      ? { id: `owner-${asked}`, name: `Заявки: ${asked}`, filter: { owner: asked } }
      : ВСЕ,
  );
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [cursor, setCursor] = useState(0);

  const filter = useMemo<LeadFilter>(
    () => ({ ...current.filter, ...(query ? { query } : {}) }),
    [current, query],
  );
  const key = JSON.stringify(filter) + `:${page}`;

  const { data, error, loading, reload, setError } = useLoad<Page<LeadRow>>(
    () => leads(filter, page),
    key,
  );
  const { data: statuses } = useLoad<string[]>(leadStatuses);

  const rows = useMemo(() => data?.items ?? [], [data]);
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const selection = useSelection(ids);

  // Поиск с выдержкой: без неё каждая буква — запрос к порталу, и на «Петров»
  // их шесть, из которых пять устареют раньше, чем вернутся.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(typed.trim());
      setPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [typed]);

  const обновить = useCallback(() => {
    reload();
    counts.refresh();
  }, [reload, counts]);

  return (
    <>
      <div className="admin-head">
        <h1>Заявки</h1>
        <div className="row">
          <label className="find">
            <SearchIcon size={16} />
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Имя, компания, телефон, почта"
              aria-label="Поиск по заявкам"
              autoComplete="off"
            />
          </label>
          <Columns columns={КОЛОНКИ} shown={shown} onChange={setShown} />
        </div>
      </div>

      <p className="admin-pd">На экране персональные данные</p>

      <Chips
        chips={чипы}
        current={current}
        filter={filter}
        onPick={(chip) => {
          setCurrent(chip);
          setPage(0);
          selection.clear();
        }}
        onSave={(name) =>
          setSaved([
            ...saved,
            { id: `own-${name}-${saved.length}`, name, filter, own: true },
          ])
        }
        onForget={(id) => {
          setSaved(saved.filter((s) => s.id !== id));
          if (current.id === id) setCurrent(ВСЕ);
        }}
      />

      <Note kind="error">{error}</Note>

      <BulkBar
        count={selection.ids.length}
        what={plural(selection.ids.length, "заявка", "заявки", "заявок")}
        onClear={selection.clear}
      >
        <Bulk
          rows={rows.filter((r) => selection.has(r.id))}
          statuses={statuses ?? []}
          onDone={(text, undo) => {
            selection.clear();
            обновить();
            toast(text, undo);
          }}
          onError={setError}
          onTriage={() => {
            const пачка = selection.ids;
            setQueue(пачка);
            setOpen(пачка[0] ?? null);
          }}
        />
      </BulkBar>

      {loading && !data && <p className="muted">Загружаем…</p>}
      {data && rows.length === 0 && (
        <Empty>
          {query || current.id !== "all"
            ? "По этому отбору заявок нет. Снимите фильтр или очистите поиск."
            : "Заявок пока не приходило."}
        </Empty>
      )}

      {rows.length > 0 && (
        <>
          <Table
            rows={rows}
            shown={shown}
            selection={selection}
            cursor={cursor}
            onCursor={setCursor}
            open={open}
            onOpen={(id) => {
              setQueue(null);
              setOpen(id);
            }}
          />

          <div className="under">
            <span className="under__count mono">
              Показаны {data!.page * data!.size + 1}–{data!.page * data!.size + rows.length} из{" "}
              {data!.total}
            </span>

            <span className="under__keys mono">
              J K — по строкам · ПРОБЕЛ — выделить · SHIFT+КЛИК — до этой строки · ⏎ — разобрать
            </span>

            {data!.pages > 1 && (
              <span className="under__pager">
                <button
                  className="btn btn--small"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Назад
                </button>
                <button
                  className="btn btn--small"
                  disabled={page + 1 >= data!.pages}
                  onClick={() => setPage(page + 1)}
                >
                  Дальше
                </button>
              </span>
            )}
          </div>
        </>
      )}

      {open && (
        <Triage
          key={open}
          id={open}
          statuses={statuses ?? []}
          queue={
            queue
              ? {
                  list: queue,
                  at: Math.max(0, queue.indexOf(open)),
                  onGo: (at) => setOpen(queue[at] ?? null),
                }
              : undefined
          }
          onClose={() => {
            setOpen(null);
            setQueue(null);
          }}
          onSaved={обновить}
        />
      )}

      <Keys
        rows={ids}
        onCursor={setCursor}
        selection={selection}
        // Пока панель разбора открыта, список клавиш молчит: под затемнением
        // J и K двигали бы строку, которую не видно.
        off={open !== null}
        onOpen={(id) => {
          setQueue(null);
          setOpen(id);
        }}
      />
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────

function Chips({
  chips,
  current,
  filter,
  onPick,
  onSave,
  onForget,
}: {
  chips: readonly Saved[];
  current: Saved;
  filter: LeadFilter;
  onPick: (chip: Saved) => void;
  onSave: (name: string) => void;
  onForget: (id: string) => void;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  return (
    <div className="chips">
      <span className="chips__label mono">Мои фильтры</span>

      {chips.map((chip) => (
        <Chip
          key={chip.id}
          chip={chip}
          on={chip.id === current.id}
          onPick={() => onPick(chip)}
          onForget={chip.own ? () => onForget(chip.id) : undefined}
        />
      ))}

      {naming ? (
        <span className="chips__new">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Как назвать"
            aria-label="Название фильтра"
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                onSave(name.trim());
                setName("");
                setNaming(false);
              }
              if (e.key === "Escape") setNaming(false);
            }}
          />
          <button
            type="button"
            className="btn btn--small"
            disabled={!name.trim()}
            onClick={() => {
              onSave(name.trim());
              setName("");
              setNaming(false);
            }}
          >
            Сохранить
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="chips__add"
          onClick={() => setNaming(true)}
          // Сохранять «Все» бессмысленно: такой фильтр уже есть первым.
          disabled={Object.keys(filter).length === 0}
          title={
            Object.keys(filter).length === 0
              ? "Сначала выберите фильтр или наберите поиск"
              : "Сохранить текущий отбор"
          }
        >
          +
        </button>
      )}
    </div>
  );
}

/**
 * Чип с числом.
 *
 * Число — отдельным запросом на чип, и это дорого выглядит, но дёшево стоит:
 * `size=1` возвращает одну строку и `total`. Смысл в том, что человек видит,
 * есть ли там работа, не открывая. Без числа чип отвечает «куда пойти»,
 * а вопрос был «есть ли зачем».
 */
function Chip({
  chip,
  on,
  onPick,
  onForget,
}: {
  chip: Saved;
  on: boolean;
  onPick: () => void;
  onForget?: () => void;
}) {
  const { data } = useLoad<Page<LeadRow>>(
    () => leads(chip.filter, 0, 1),
    JSON.stringify(chip.filter),
  );

  return (
    <span className={`chip${on ? " chip--on" : ""}`}>
      <button type="button" className="chip__pick" onClick={onPick} aria-pressed={on}>
        {chip.name}
        {data && <span className="chip__count mono">{data.total}</span>}
      </button>
      {onForget && (
        <button
          type="button"
          className="chip__forget"
          onClick={onForget}
          aria-label={`Убрать фильтр «${chip.name}»`}
        >
          ×
        </button>
      )}
    </span>
  );
}

// ───────────────────────────────────────────────────────────────────────────

/**
 * Массовые действия.
 *
 * `triageLead` ставит статус и ответственного вместе — отдельной двери
 * «только ответственный» у портала нет. Поэтому каждое действие берёт
 * недостающее из строки на экране: смена статуса сохраняет ответственного
 * каждой заявки, назначение ответственного сохраняет её статус. Подставить
 * общее значение значило бы тихо снести то, чего не трогали.
 */
function Bulk({
  rows,
  statuses,
  onDone,
  onError,
  onTriage,
}: {
  rows: readonly LeadRow[];
  statuses: readonly string[];
  onDone: (text: string, undo?: () => Promise<unknown>) => void;
  onError: (message: string | null) => void;
  onTriage: () => void;
}) {
  const [what, setWhat] = useState<"" | "owner" | "status">("");
  const [owner, setOwner] = useState("");
  const [busy, setBusy] = useState(false);

  /** Применяет к каждой строке своё значение и возвращает откат. */
  async function apply(
    next: (row: LeadRow) => { status: string; owner: string | null },
    text: string,
  ) {
    setBusy(true);
    onError(null);
    const было = rows.map((r) => ({ id: r.id, status: r.status, owner: r.owner }));

    try {
      const результат = await Promise.allSettled(
        rows.map((row) => {
          const { status, owner } = next(row);
          return triageLead(row.id, status, owner);
        }),
      );

      const отказов = результат.filter((r) => r.status === "rejected").length;
      if (отказов > 0) {
        // Частичный отказ — не «получилось» и не «не получилось».
        // Названо числом: остальное человек увидит в перезагруженном списке.
        onError(
          `Не удалось изменить ${отказов} из ${rows.length}. Остальные изменены; ` +
            `откройте отказавшие по одной, чтобы увидеть причину.`,
        );
      }

      onDone(text, async () => {
        await Promise.all(было.map((r) => triageLead(r.id, r.status, r.owner)));
      });
    } catch (e) {
      onError(message(e));
    } finally {
      setBusy(false);
      setWhat("");
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn--small"
        disabled={busy}
        onClick={() => setWhat(what === "owner" ? "" : "owner")}
      >
        Назначить ответственного
      </button>

      <button
        type="button"
        className="btn btn--small"
        disabled={busy}
        onClick={() => setWhat(what === "status" ? "" : "status")}
      >
        Сменить статус
      </button>

      <button type="button" className="btn btn--small" disabled={busy} onClick={onTriage}>
        Разобрать в сделки
      </button>

      {what === "owner" && (
        <div className="bulk__pop">
          <OwnerField
            value={owner}
            onChange={(login) => setOwner(login ?? "")}
            hint="Пусто — снять ответственного у всех выбранных."
          />
          <button
            type="button"
            className="btn btn--small btn--primary"
            disabled={busy}
            onClick={() =>
              void apply(
                (row) => ({ status: row.status, owner: owner.trim() || null }),
                `Ответственный изменён у ${rows.length} ${plural(rows.length, "заявки", "заявок", "заявок")}`,
              )
            }
          >
            Назначить
          </button>
        </div>
      )}

      {what === "status" && (
        <div className="bulk__pop">
          <Segments
            label="Новый статус"
            value=""
            options={statuses}
            dict={LEAD_STATUS}
            onChange={(status) =>
              void apply(
                (row) => ({ status, owner: row.owner }),
                `Статус «${label(LEAD_STATUS, status)}» у ${rows.length} ${plural(rows.length, "заявки", "заявок", "заявок")}`,
              )
            }
          />
        </div>
      )}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────

function Table({
  rows,
  shown,
  selection,
  cursor,
  onCursor,
  open,
  onOpen,
}: {
  rows: readonly LeadRow[];
  shown: readonly string[];
  selection: ReturnType<typeof useSelection>;
  cursor: number;
  onCursor: (index: number) => void;
  open: string | null;
  onOpen: (id: string) => void;
}) {
  const видно = (key: string) => shown.includes(key);

  return (
    <div className="admin-scroll">
      <table className="admin-table admin-table--pick">
        <thead>
          <tr>
            <th className="tight">
              <HeadBox selection={selection} rows={rows.map((r) => r.id)} what="заявки" />
            </th>
            <th>Когда</th>
            {видно("form") && <th>Форма</th>}
            <th>Кто обратился</th>
            {видно("contacts") && <th>Контакты</th>}
            {видно("source") && <th>Источник</th>}
            <th>Статус</th>
            {видно("owner") && <th>Ответственный</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const выбрана = selection.has(row.id);
            const ничей = row.owner === null;
            return (
              <tr
                key={row.id}
                className={[
                  выбрана || open === row.id ? "row--on" : "",
                  ничей ? "row--wait" : "",
                  i === cursor ? "row--cursor" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={(e) => {
                  onCursor(i);
                  // SHIFT+КЛИК выделяет диапазон, обычный щелчок открывает
                  // разбор. Разводить их некуда: строка — это и запись,
                  // и элемент выделения.
                  if (e.shiftKey) {
                    e.preventDefault();
                    selection.range(row.id);
                    return;
                  }
                  onOpen(row.id);
                }}
              >
                <td className="tight" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={выбрана}
                    onChange={() => selection.toggle(row.id)}
                    aria-label={`Выбрать заявку: ${row.name}, ${when(row.createdAt)}`}
                  />
                </td>

                <td className="tight mono">{when(row.createdAt)}</td>

                {видно("form") && (
                  <td className="tight">{label(FORM, row.form)}</td>
                )}

                <td>
                  <span className="row__name">{row.name}</span>
                  {row.company && <span className="row__under">{row.company}</span>}
                </td>

                {видно("contacts") && (
                  <td className="tight">
                    <span className="row__line mono">{row.phone}</span>
                    <span className="row__line mono">{row.email}</span>
                  </td>
                )}

                {видно("source") && (
                  <td className="tight">{label(LEAD_SOURCE, row.source)}</td>
                )}

                <td className="tight">
                  <State value={row.status} dict={LEAD_STATUS} />
                </td>

                {видно("owner") && (
                  <td className="tight">
                    {ничей ? <span className="nobody">не назначен</span> : row.owner}
                  </td>
                )}

                <td className="tight">
                  {/* Имя кнопки называет заявку: обход с клавиатуры давал
                      семь кнопок «Разобрать» подряд, и какая к какой заявке —
                      узнать было неоткуда. Одного имени мало, у семи заявок
                      оно совпадало; различает их время обращения. */}
                  <button
                    type="button"
                    className="row__go"
                    aria-label={`Разобрать заявку: ${row.name}, ${when(row.createdAt)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(row.id);
                    }}
                  >
                    открыть ⏎
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────

/**
 * Клавиши списка.
 *
 * Отдельным компонентом без разметки: слушатель нужен один, а вешать его
 * внутри таблицы значит пересобирать на каждой перерисовке строки.
 *
 * J и K, а не только стрелки: стрелки прокручивают страницу, и на длинном
 * списке курсор уезжает вместе с ней. Стрелки при этом тоже работают —
 * пришедший из почты попробует их первыми.
 */
function Keys({
  rows,
  onCursor,
  selection,
  off,
  onOpen,
}: {
  rows: readonly string[];
  /** Только обновлением от прежнего значения: два нажатия подряд
   *  приходят в одном такте, и оба прочитали бы один и тот же курсор. */
  onCursor: (move: (index: number) => number) => void;
  selection: ReturnType<typeof useSelection>;
  off: boolean;
  onOpen: (id: string) => void;
}) {
  const свежие = useRef({ rows, onCursor, selection, off, onOpen });
  useEffect(() => {
    свежие.current = { rows, onCursor, selection, off, onOpen };
  });

  useEffect(() => {
    const слушатель = (e: KeyboardEvent) => {
      const { rows, onCursor, selection, off, onOpen } = свежие.current;
      if (off || rows.length === 0) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target;
      if (target instanceof HTMLElement) {
        const тег = target.tagName;
        if (
          target.isContentEditable ||
          тег === "INPUT" ||
          тег === "TEXTAREA" ||
          тег === "SELECT"
        ) {
          return;
        }
      }

      // И по физической клавише, и по букве: `code` не зависит от
      // раскладки, а `key` выручает там, где событие приходит без него.
      const вниз = e.code === "KeyJ" || e.key === "j" || e.key === "ArrowDown";
      const вверх = e.code === "KeyK" || e.key === "k" || e.key === "ArrowUp";

      if (вниз || вверх) {
        e.preventDefault();
        const шаг = вниз ? 1 : -1;
        // Обновлением от прежнего значения, а не от прочитанного:
        // два нажатия в одном такте оба видели бы стартовый курсор
        // и сдвигали список на одну строку вместо двух. Замер на стенде:
        // два J подряд перемещали курсор с нулевой строки на первую.
        onCursor((c) => Math.min(rows.length - 1, Math.max(0, c + шаг)));
        return;
      }

      if (e.code === "Space" || e.key === " ") {
        // Иначе пробел прокручивает страницу, и выделенная строка уезжает.
        e.preventDefault();
        // Курсор читается тем же способом — обновлением: между нажатием
        // J и пробелом может не быть ни одной отрисовки.
        onCursor((c) => {
          selection.toggle(rows[c]);
          return c;
        });
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        onCursor((c) => {
          onOpen(rows[c]);
          return c;
        });
      }
    };

    document.addEventListener("keydown", слушатель);
    return () => document.removeEventListener("keydown", слушатель);
  }, []);

  return null;
}
