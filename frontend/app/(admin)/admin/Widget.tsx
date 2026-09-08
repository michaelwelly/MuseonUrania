"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { chatQueue, chatThread, type ChatCard } from "@/lib/admin";
import { plural } from "@/lib/plural";
import { useCounts } from "./counts";
import { useLive } from "./live";
import { CloseIcon, CrossIcon } from "./icons";
import Thread from "./Thread";
import { waited as словами, where } from "./ui";

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
// Ответить можно прямо отсюда: карточка открывает ленту в самой панели.
// Лента при этом та же, что в разделе, — общий компонент `Thread`. Своей
// реализации здесь нет намеренно: отметка о прочтении, оценка ответа
// Ведалины, «печатает», заготовки и Enter как отправка разошлись бы в двух
// копиях на первой же правке.
//
// «Развернуть» никуда не делось и ведёт в раздел, открытый на этом разговоре:
// три колонки нужны, когда разбираешься, кто написал и откуда, — в панели
// столько не показать.

const В_ОЧЕРЕДИ = 5;

type Карточка = ChatCard & { first: string | null };

export function Widget() {
  const [open, setOpen] = useState(false);
  // Разговор, открытый прямо в панели. Раньше карточка уводила в раздел,
  // и менеджер, правивший сделку, терял место, на котором работал, — ради
  // двух строк ответа.
  const [talking, setTalking] = useState<string | null>(null);
  const { counts } = useCounts();
  const ждут = counts.chats ?? 0;

  // Закрытая панель забывает открытый разговор: вернувшись через час,
  // человек ждёт очередь, а не переписку, которую он уже закрыл.
  function toggle() {
    setOpen((было) => {
      if (было) setTalking(null);
      return !было;
    });
  }

  // Пока панель открыта, страница отступает вправо на её ширину (см.
  // .admin-body--widget в admin.css). Иначе панель ложится поверх таблицы:
  // на живом стенде она закрывала у заявок колонки «Источник», «Статус»
  // и «Ответственный».
  //
  // Класс на body, а не на своей обёртке: раздвинуть надо страницу, а
  // виджет к ней не относится — он висит поверх всего, что есть в оболочке.
  useEffect(() => {
    const классы = document.body.classList;
    классы.toggle("admin-body--widget", open);
    классы.toggle("admin-body--widget-talk", open && talking !== null);
    return () => {
      классы.remove("admin-body--widget");
      классы.remove("admin-body--widget-talk");
    };
  }, [open, talking]);

  return (
    <div className="widget">
      {/* Панель заводится открытием, а не прячется стилями: спрятанная она
          продолжала бы тикать часами и перечитывать очередь у человека,
          который её закрыл. */}
      {open &&
        (talking ? (
          <Talk
            id={talking}
            onBack={() => setTalking(null)}
            onClose={() => {
              setTalking(null);
              setOpen(false);
            }}
          />
        ) : (
          <Queue
            ждут={ждут}
            onOpen={setTalking}
            onClose={() => setOpen(false)}
          />
        ))}

      {/* title — ради всплывающей подсказки: подпись «Разговоры» на кнопке
          скрыта с глаз (см. .widget__label в admin.css), и наведение —
          единственный способ прочитать её тому, кто видит только круг. */}
      <button
        type="button"
        className="widget__button"
        title="Разговоры"
        aria-expanded={open}
        onClick={toggle}
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

function Queue({
  ждут,
  onOpen,
  onClose,
}: {
  ждут: number;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Карточка[] | null>(null);
  // Открытая панель перечитывается на событие: без этого она показывала
  // очередь на момент открытия, и разговор, пришедший минуту назад,
  // в ней не появлялся — при том что счётчик на кнопке рядом уже вырос.
  const [заход, setЗаход] = useState(0);
  // Время заводится при открытии и тикает раз в минуту: «ждёт 4 мин» иначе
  // застывает на том значении, что было при первом взгляде.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useLive({ changed: () => setЗаход((n) => n + 1) });

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
    // Перечитываем и при событии в разговорах: панель открыта, а очередь
    // за это время изменилась.
  }, [заход]);

  const дольше_всех = longest(rows, now);

  return (
    <div className="widget__panel" role="dialog" aria-label="Разговоры, ждущие ответа">
      {/* Шапка в две строки: знак, название, «Развернуть» и крестик — сверху,
          сколько ждут — своей строкой во всю ширину. В один ряд это не
          помещалось, и сжималась именно подпись с числом ждущих, ради
          которой в шапку и смотрят. */}
      <div className="widget__head widget__head--queue">
        <span className="widget__disc" aria-hidden="true">
          <CrossIcon size={18} />
        </span>
        <span className="widget__title">Разговоры</span>
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
        <span className="widget__sub mono">
          {ждут === 0
            ? "никто не ждёт ответа"
            : `${ждут} ${plural(ждут, "ждёт", "ждут", "ждут")} ответа${
                дольше_всех === null ? "" : ` · дольше всех ${словами(дольше_всех)}`
              }`}
        </span>
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
            // Кнопка, а не ссылка: разговор открывается здесь же. Ссылкой
            // он был, пока отвечать из панели было нечем, и каждый ответ
            // стоил ухода с рабочего экрана.
            <button
              key={c.id}
              type="button"
              className="widget__row"
              onClick={() => onOpen(c.id)}
            >
              <span
                className={`widget__mark${поздно ? " widget__mark--late" : ""}`}
                aria-hidden="true"
              />
              <span className="widget__row-body">
                <span className="widget__first">{c.first ?? "обращение читается…"}</span>
                <span className="widget__where mono">{where(c.page)}</span>
              </span>
              <span className={`widget__waited mono${поздно ? " widget__waited--late" : ""}`}>
                {словами(мин)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Разговор прямо в панели.
 *
 * Лента здесь та же самая, что в разделе «Разговоры», — один компонент
 * на два места. Своя реализация означала бы две отметки о прочтении, две
 * обработки Enter и два места, где чинить одну ошибку.
 */
function Talk({
  id,
  onBack,
  onClose,
}: {
  id: string;
  onBack: () => void;
  onClose: () => void;
}) {
  // Событие из потока перечитывает ленту: ответ посетителя должен появиться
  // сам, без обновления страницы.
  const [beat, setBeat] = useState(0);
  const [typing, setTyping] = useState(false);
  const fade = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLive({
    changed: () => setBeat((b) => b + 1),
    typing: (conversationId) => {
      if (conversationId !== id) return;
      setTyping(true);
      if (fade.current) clearTimeout(fade.current);
      // Надпись гаснет сама: события «перестал печатать» нет и быть не может,
      // человек может просто закрыть вкладку.
      fade.current = setTimeout(() => setTyping(false), 5000);
    },
  });

  useEffect(() => () => {
    if (fade.current) clearTimeout(fade.current);
  }, []);

  return (
    <div className="widget__panel widget__panel--talk" role="dialog" aria-label="Разговор">
      <div className="widget__head">
        <button type="button" className="widget__back" onClick={onBack}>
          ← К очереди
        </button>
        <Link className="widget__more" href={`/admin/chats/?id=${encodeURIComponent(id)}`}>
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

      <div className="widget__talk">
        <Thread id={id} beat={beat} typing={typing} onDone={() => setBeat((b) => b + 1)} />
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
