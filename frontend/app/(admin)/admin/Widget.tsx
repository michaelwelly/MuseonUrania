"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { chatQueue, chatThread, type ChatCard } from "@/lib/admin";
import { plural } from "@/lib/plural";
import { useCounts } from "./counts";
import { CloseIcon, CrossIcon } from "./icons";
import { waited as словами } from "./ui";

// Виджет разговоров.
//
// Это единственная запись портала, у которой на том конце ждёт человек.
// Заявка, документ и сделка подождут до конца дня; посетитель, которому
// Ведалина не смогла ответить, смотрит в пустое окно прямо сейчас. Поэтому
// разговоры вынесены из раздела на все экраны: менеджер, правящий сделку,
// не обязан помнить, что надо сходить проверить очередь.
//
// Кнопка — та же, что у посетителя на сайте (`VedalinaWidget`): тёмная
// таблетка внизу справа, белый диск со знаком, зелёная точка. Совпадение
// не случайно и не лень: по обе стороны разговора одна и та же вещь, и
// узнаваться она должна одинаково.
//
// ───────────────────────────────────────────────────────────────────────────
// Что берётся откуда
//
// Счётчик на кнопке — тот же, что на вкладке «Разговоры»: очередь ждущих.
// Второго запроса он не стоит, число уже прочитано оболочкой.
//
// Первая строка обращения в карточке очереди приходит не со списком:
// `ChatCard` несёт статус, страницу и время, но не текст. Он вытягивается
// лентой разговора по каждой карточке — очередь мала по своей природе
// (это «ждут ответа», а не «все разговоры»), и пять запросов на открытие
// панели дешевле, чем строка «—» на месте вопроса, ради которого сюда
// и заходят.
//
// Ответ прямо из панели появится вместе с переделкой раздела «Разговоры»:
// поле ответа — это лента, заготовки, отметка о прочтении и поток событий,
// и делать им вторую реализацию в виджете значит завести два места, где
// чинить одну ошибку. Пока карточка ведёт в раздел, открытый на этом
// разговоре.

const В_ОЧЕРЕДИ = 5;

type Карточка = ChatCard & { first: string | null };

export function Widget() {
  const [open, setOpen] = useState(false);
  const { counts } = useCounts();
  const ждут = counts.chats ?? 0;

  return (
    <div className="widget">
      {/* Панель заводится открытием, а не прячется стилями: спрятанная она
          продолжала бы тикать часами и перечитывать очередь у человека,
          который её закрыл. */}
      {open && <Queue ждут={ждут} onClose={() => setOpen(false)} />}

      <button
        type="button"
        className="widget__button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="widget__disc" aria-hidden="true">
          <CrossIcon size={20} />
          <span className="widget__pulse" />
        </span>
        <span className="widget__label">Разговоры</span>
        {ждут > 0 && <span className="widget__count mono">{ждут}</span>}
      </button>
    </div>
  );
}

function Queue({ ждут, onClose }: { ждут: number; onClose: () => void }) {
  const [rows, setRows] = useState<Карточка[] | null>(null);
  // Время заводится при открытии и тикает раз в минуту: «ждёт 4 мин» иначе
  // застывает на том значении, что было при первом взгляде.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;

    void chatQueue(0, В_ОЧЕРЕДИ)
      .then(async (page) => {
        if (!alive) return;
        // Сначала карточки без текста, чтобы список появился сразу, а строки
        // обращения дописались следом. Ждать все ленты значит держать панель
        // пустой ровно столько, сколько идёт самый медленный запрос.
        setRows(page.items.map((c) => ({ ...c, first: null })));

        const ленты = await Promise.allSettled(page.items.map((c) => chatThread(c.id)));
        if (!alive) return;
        setRows(
          page.items.map((c, i) => {
            const лента = ленты[i];
            const первая =
              лента.status === "fulfilled"
                ? (лента.value.messages.find((m) => m.author === "visitor")?.body ?? null)
                : null;
            return { ...c, first: первая };
          }),
        );
      })
      .catch(() => alive && setRows([]));

    return () => {
      alive = false;
    };
  }, []);

  const дольше_всех = longest(rows, now);

  return (
    <div className="widget__panel" role="dialog" aria-label="Разговоры, ждущие ответа">
      <div className="widget__head">
        <span className="widget__disc" aria-hidden="true">
          <CrossIcon size={18} />
        </span>
        <span className="widget__headings">
          <span className="widget__title">Разговоры</span>
          <span className="widget__sub mono">
            {ждут === 0
              ? "никто не ждёт ответа"
              : `${ждут} ${plural(ждут, "ждёт", "ждут", "ждут")} ответа${
                  дольше_всех === null ? "" : ` · дольше всех ${словами(дольше_всех)}`
                }`}
          </span>
        </span>
        <Link className="widget__more" href="/admin/chats/" onClick={onClose}>
          Развернуть
        </Link>
        <button
          type="button"
          className="widget__close"
          onClick={onClose}
          aria-label="Закрыть виджет"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="widget__list">
        {rows === null && <p className="widget__none">Читаем очередь…</p>}
        {rows?.length === 0 && (
          <p className="widget__none">Никто не ждёт ответа. Ведалина справляется сама.</p>
        )}
        {rows?.map((c) => {
          const мин = waited(c.lastAt, now);
          const поздно = мин >= 5;
          return (
            <Link
              key={c.id}
              className="widget__row"
              href={`/admin/chats/?id=${encodeURIComponent(c.id)}`}
              onClick={onClose}
            >
              <span
                className={`widget__mark${поздно ? " widget__mark--late" : ""}`}
                aria-hidden="true"
              />
              <span className="widget__row-body">
                <span className="widget__first">{c.first ?? "обращение читается…"}</span>
                <span className="widget__where mono">{c.page ?? "страница неизвестна"}</span>
              </span>
              <span className={`widget__waited mono${поздно ? " widget__waited--late" : ""}`}>
                {словами(мин)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Сколько минут ждёт разговор. */
function waited(lastAt: string, now: number): number {
  const был = new Date(lastAt).valueOf();
  if (Number.isNaN(был)) return 0;
  // Отрицательное время означает расхождение часов машины и портала.
  // Показывать «-3 мин» незачем: для человека это «только что».
  return Math.max(0, Math.floor((now - был) / 60_000));
}

function longest(rows: Карточка[] | null, now: number): number | null {
  if (!rows || rows.length === 0) return null;
  return Math.max(...rows.map((c) => waited(c.lastAt, now)));
}
