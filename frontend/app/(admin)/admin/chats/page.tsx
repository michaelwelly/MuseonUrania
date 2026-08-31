"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  chatQueue,
  chatThread,
  chatsAll,
  closeChat,
  eraseChatData,
  pingTypingInChat,
  replyInChat,
  type ChatCard,
  type ChatThread,
  type Page,
} from "@/lib/admin";
import { useLive } from "../live";
import { apiUrl } from "@/lib/submit";
import EraseData from "../EraseData";
import { CHAT_STATUS, LEAD_LANGUAGE, label } from "../labels";
import { Note, message, useLoad, waited, when } from "../ui";

// Разговоры посетителей.
//
// Единственный экран портала, где на том конце ждёт человек. Отсюда три
// колонки: очередь — кому отвечать, переписка — что говорили, «что известно» —
// кто это. Раньше третьей колонки не было, и ответ на «откуда он пришёл»
// требовал ухода с экрана, на котором человек ждёт.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему первая строка обращения читается отдельно
//
// `ChatCard` несёт статус, страницу и время, но не текст: список разговоров
// не тащит переписку. А очередь без первой строки — это столбик одинаковых
// карточек, из которого нельзя выбрать, кому ответить первым.
//
// Строка вытягивается лентой по каждой карточке и запоминается: первое
// сообщение посетителя не меняется никогда, и перечитывать его на каждое
// событие потока незачем.
//
// ───────────────────────────────────────────────────────────────────────────
// Чего здесь нет и почему
//
// Дежурства. В макете плашка «ДЕЖУРИТ СЕГОДНЯ» с кнопкой «Передать»; графика
// дежурств портал по-прежнему не знает — ни таблицы, ни двери, и передавать
// смену некому. Плашка стоит и говорит это.
//
// Посетитель при этом видит не пустоту: в виджете написано, есть ли сейчас
// кто-то на связи. Это не дежурство, а факт — открыто ли хоть одно рабочее
// место; считает его ChatStream, и открытая эта страница как раз и означает
// «человек смотрит в экран». Часы работы поддержки лежат в настройках
// портала (vedal.support.*).
//
// Фильтра «с Ведалиной». Портал отдаёт две выборки — очередь ждущих и все
// разговоры. Третью пришлось бы собирать в браузере из загруженной страницы,
// и счётчик у неё считал бы страницу, а не разговоры.
//
// Кнопки «В заявку». Двери, которая заводит заявку из разговора, у портала
// нет: заявка несёт согласие с версией текста, а разговор его не несёт.
// Это не кнопка, а решение — что считать согласием.

const ЗАГОТОВКИ = [
  "Здравствуйте! Сейчас посмотрю и вернусь с ответом.",
  "Уточните, пожалуйста, модель и задачу — так отвечу точнее.",
  "Передаю вопрос инженеру, ответим в этом же окне.",
];

export default function ChatsPage() {
  // Разговор адресуем: `/admin/chats/?id=…` открывает ленту сразу.
  // Понадобилось виджету в оболочке, но польза шире: разговор стал вещью,
  // на которую можно дать ссылку в переписке между сотрудниками.
  //
  // Suspense обязателен: без границы useSearchParams уводит страницу
  // в отрисовку на клиенте целиком, и сборка об этом предупреждает.
  return (
    <Suspense fallback={<p className="muted">Загружаем…</p>}>
      <Chats />
    </Suspense>
  );
}

function Chats() {
  const params = useSearchParams();
  // По умолчанию — ВСЕ разговоры, свежие сверху, а не очередь ожидающих.
  //
  // Сначала было наоборот, и это была ошибка замысла: очередь показывает
  // только тех, кому Ведалина не смогла ответить. Разговор, который идёт
  // прямо сейчас и по которому она справляется, в неё не попадает — и экран,
  // сделанный чтобы видеть посетителей вживую, ровно их и прятал.
  const [tab, setTab] = useState<"all" | "queue">("all");
  // Разговор из адреса — только начальное значение: дальше выбор ведёт
  // состояние. Иначе кнопка «назад» в браузере возвращала бы не на прошлый
  // разговор, а на прошлый адрес, и они разъехались бы на первом же щелчке.
  const [open, setOpen] = useState<string | null>(() => params.get("id"));
  // Ответственный приходит адресом — с карточки сотрудника. В очереди этого
  // отбора нет и не будет: в ней по определению лежат невзятые разговоры.
  const owner = params.get("owner") ?? "";
  // Меняется на каждое событие из потока — по нему перезагружаются и список,
  // и лента. Отдельный счётчик, а не время: время сравнивается неточно, если
  // два события пришли в одну миллисекунду.
  const [beat, setBeat] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const { data, error, setError } = useLoad<Page<ChatCard>>(
    () => (tab === "queue" && !owner ? chatQueue() : chatsAll(owner)),
    `${tab}:${owner}:${beat}`,
  );

  // Число ждущих нужно и когда открыта вкладка «Все»: это единственный
  // счётчик экрана, который означает работу прямо сейчас. Под отбором
  // по сотруднику он не спрашивается вовсе — вкладок там нет, а число
  // «сколько ждут во всём портале» рядом с чужим именем читается неверно.
  const { data: queue } = useLoad<Page<ChatCard> | null>(
    () => (owner ? Promise.resolve(null) : chatQueue(0, 1)),
    `queue-count:${owner}:${beat}`,
  );

  // Кто печатает прямо сейчас: идентификатор разговора и когда пришло событие.
  // Надпись живёт секунды и гаснет сама — сообщения «перестал печатать» нет
  // и быть не может: человек может просто закрыть вкладку.
  const [typingIn, setTypingIn] = useState<string | null>(null);
  const fade = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTyping = useCallback((conversationId: string) => {
    setTypingIn(conversationId);
    if (fade.current) clearTimeout(fade.current);
    fade.current = setTimeout(() => setTypingIn(null), 5000);
  }, []);

  useEffect(() => () => {
    if (fade.current) clearTimeout(fade.current);
  }, []);

  // Время ожидания тикает раз в минуту: «4 мин» иначе застывает на том
  // значении, что было при открытии экрана, а экран открыт весь день.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Поток теперь общий на всю админку (LiveHost в оболочке): раздел
  // «Разговоры» — один из его слушателей, а не владелец. Свой поток
  // рядом с общим означал бы два соединения с одной вкладки, а у портала
  // на них стоят пределы.
  useLive({
    changed: () => setBeat((b) => b + 1),
    typing: onTyping,
  });

  const rows = useMemo(() => data?.items ?? [], [data]);
  const first = useFirstLines(rows);
  const выбран = rows.find((c) => c.id === open) ?? null;

  return (
    <>
      <div className="admin-head">
        <h1>Разговоры</h1>
        {/* Дежурство портал не хранит: ни таблицы, ни двери. Плашка на месте
            и говорит, чего не хватает, — иначе имя дежурного пришлось бы
            выдумать, а по нему передают разговоры. */}
        <p className="duty">
          <span className="duty__label mono">Дежурство</span>
          <span className="duty__wait">ожидает уточнения</span>
          <span className="duty__why">портал не хранит, кто сегодня на линии</span>
        </p>
      </div>

      <p className="admin-pd">На экране могут быть персональные данные</p>

      {owner && (
        <p className="admin-hint">
          {/* «-» — это «никто не взял», а не логин с таким именем. */}
          {owner === "-" ? (
            <>Показаны разговоры, которых никто не взял. </>
          ) : (
            <>
              Показаны разговоры одного сотрудника: <span className="mono">{owner}</span>.{" "}
            </>
          )}
          <Link href="/admin/chats/">Показать все</Link>
        </p>
      )}

      <Note kind="error">{error}</Note>

      <div className="chats3">
        <aside className="chats3__queue">
          {/* Под отбором по сотруднику вкладок нет. Очередь — это невзятые
              разговоры, у них ответственного нет по определению, и вкладка
              «Ждут ответа» рядом с отобранным списком либо показывала бы
              не то, что выделено, либо считала бы всех подряд: «1» на ней
              означало бы одного ждущего в портале, а прочитано было бы как
              «один ждёт у этого сотрудника». */}
          {!owner && (
          <div className="chips">
            <span className={`chip${tab === "queue" ? " chip--on" : ""}`}>
              <button
                type="button"
                className="chip__pick"
                aria-pressed={tab === "queue"}
                onClick={() => setTab("queue")}
              >
                Ждут ответа
                {queue && <span className="chip__count mono">{queue.total}</span>}
              </button>
            </span>
            <span className={`chip${tab === "all" ? " chip--on" : ""}`}>
              <button
                type="button"
                className="chip__pick"
                aria-pressed={tab === "all"}
                onClick={() => setTab("all")}
              >
                Все
                {data && tab === "all" && <span className="chip__count mono">{data.total}</span>}
              </button>
            </span>
          </div>
          )}

          {rows.length === 0 && (
            <p className="admin-hint">
              {owner === "-"
                ? "Невзятых разговоров нет."
                : owner
                ? "На этом сотруднике разговоров нет."
                : tab === "queue"
                  ? "Никто не ждёт ответа."
                  : "Разговоров пока не было."}
            </p>
          )}

          {rows.map((c) => {
            const мин = Math.max(0, Math.floor((now - new Date(c.lastAt).valueOf()) / 60_000));
            const ждёт = c.status === "waiting";
            return (
              <button
                key={c.id}
                type="button"
                className={`talk${open === c.id ? " talk--on" : ""}`}
                onClick={() => setOpen(c.id)}
              >
                <span className="talk__top">
                  <span className={`badge ${БЕЙДЖ[c.status] ?? ""}`}>
                    {label(CHAT_STATUS, c.status)}
                  </span>
                  {/* Дольше пяти минут — это уже не «сейчас ответят». */}
                  <span
                    className={`talk__waited mono${ждёт && мин >= 5 ? " talk__waited--late" : ""}`}
                  >
                    {waited(мин)}
                  </span>
                </span>
                <span className="talk__first">{first[c.id] ?? "обращение читается…"}</span>
                <span className="talk__where mono">{c.page ?? "страница неизвестна"}</span>
              </button>
            );
          })}
        </aside>

        <section className="chats3__thread">
          {open ? (
            <Thread
              key={open}
              id={open}
              beat={beat}
              typing={typingIn === open}
              onDone={() => setBeat((b) => b + 1)}
            />
          ) : (
            <p className="admin-hint">Выберите разговор слева.</p>
          )}
        </section>

        <aside className="chats3__known">
          {выбран ? (
            <Known card={выбран} onDone={() => setBeat((b) => b + 1)} />
          ) : (
            <p className="side__idle">Здесь будет то, что известно о посетителе.</p>
          )}
        </aside>
      </div>
    </>
  );
}

const БЕЙДЖ: Record<string, string> = {
  waiting: "badge--warn",
  attended: "badge--on",
  closed: "badge--off",
};

/**
 * Первые строки обращений — по одной на разговор, и только по разу.
 *
 * Первое сообщение посетителя не меняется никогда, поэтому прочитанное
 * запоминается. Без этого поток событий — а он приходит на каждое сообщение
 * в любом разговоре — перечитывал бы двадцать лент на каждое чужое «спасибо».
 */
function useFirstLines(rows: readonly ChatCard[]): Record<string, string> {
  const [lines, setLines] = useState<Record<string, string>>({});
  const known = useRef(new Set<string>());
  const ids = rows.map((c) => c.id).join(",");

  useEffect(() => {
    const свежие = ids
      .split(",")
      .filter(Boolean)
      .filter((id) => !known.current.has(id))
      .slice(0, 12);
    if (свежие.length === 0) return;

    свежие.forEach((id) => known.current.add(id));
    let alive = true;

    void Promise.allSettled(свежие.map((id) => chatThread(id))).then((ленты) => {
      if (!alive) return;
      const добавка: Record<string, string> = {};
      ленты.forEach((лента, i) => {
        if (лента.status !== "fulfilled") {
          // Не прочиталось — пусть попробует ещё раз со следующим списком.
          known.current.delete(свежие[i]);
          return;
        }
        const первое = лента.value.messages.find((m) => m.author === "visitor");
        добавка[свежие[i]] = первое ? первое.body : "посетитель пока молчит";
      });
      setLines((было) => ({ ...было, ...добавка }));
    });

    return () => {
      alive = false;
    };
  }, [ids]);

  return lines;
}

/** Что известно о посетителе. Всё из карточки разговора — больше портал не знает. */
function Known({ card, onDone }: { card: ChatCard; onDone: () => void }) {
  return (
    <div className="side__card">
      <span className="side__eyebrow mono">Что известно</span>

      {/* У каждой пустоты своё слово, и это не украшение.
          «Ожидает уточнения» означает «данные должны быть, но их нет
          и кто-то должен внести». Разговор без ответственного не ждёт
          уточнения — его просто никто не взял, и это состояние, а не
          пробел. Разговор без кампании пришёл сам, и уточнять там
          нечего. Пометив всё одним словом, метка перестаёт значить
          что-либо, а вместе с ней и «ожидает уточнения» на карточке
          изделия. */}
      <dl className="pairs">
        <Pair name="Страница" value={card.page} empty="не записана" />
        <Pair
          name="Язык"
          value={card.language ? label(LEAD_LANGUAGE, card.language) : null}
          empty="не записан"
        />
        <Pair name="Кампания" value={card.campaign} empty="пришёл сам, без кампании" />
        <Pair name="Начат" value={when(card.startedAt)} />
        <Pair name="Ответственный" value={card.owner} empty="никто не взял" />
      </dl>

      <p className="triage__note">
        Больше портал о посетителе не знает: имя и телефон он называет сам, в переписке.
        Двери, которая завела бы из разговора заявку, нет — заявка несёт согласие
        с версией текста, а разговор его не несёт.
      </p>

      {/* Обращение по переписке исполняется здесь: посетитель мог написать
          своё имя и телефон прямо в чат, и обычно именно так и делает. */}
      <EraseData
        what="тексты всех сообщений — и посетителя, и Ведалины, и сотрудника"
        erase={() => eraseChatData(card.id)}
        onDone={onDone}
      />
    </div>
  );
}

/** Пара «ключ — значение». Незаполненное названо своими словами. */
function Pair({
  name,
  value,
  empty = "ожидает уточнения",
}: {
  name: string;
  value: string | null;
  empty?: string;
}) {
  return (
    <div className="pairs__row">
      <dt>{name}</dt>
      <dd className={value ? "mono" : "nobody"}>{value ?? empty}</dd>
    </div>
  );
}

function Thread({
  id,
  beat,
  typing,
  onDone,
}: {
  id: string;
  beat: number;
  /** Посетитель печатает прямо сейчас. */
  typing: boolean;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const { data, error, setError } = useLoad<ChatThread>(() => chatThread(id), `${id}:${beat}`);
  const bottom = useRef<HTMLDivElement>(null);
  const поле = useRef<HTMLTextAreaElement>(null);
  // Когда последний раз сообщали, что сотрудник печатает. Не на каждую букву:
  // получился бы поток запросов ради надписи, которая и так не меняется.
  const pinged = useRef(0);

  function announceTyping() {
    const now = Date.now();
    if (now - pinged.current < 3000) return;
    pinged.current = now;
    void pingTypingInChat(id);
  }

  // Лента прокручивается к последнему сообщению: разговор читают с конца,
  // и открывать его в начале значит заставлять листать при каждом ответе.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [data]);

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    try {
      await replyInChat(id, text);
      setDraft("");
      onDone();
    } catch (e) {
      setError(message(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Note kind="error">{error}</Note>

      <div className="thread">
        {data?.messages.map((m, i) => (
          <div key={i} className={`bubble bubble--${m.author}`}>
            <div className="bubble__who">
              {m.author === "visitor" ? "Посетитель" : m.author === "staff" ? m.actor : "Ведалина"}
              <span className="muted"> · {when(m.at)}</span>
            </div>
            <div className="bubble__body">{m.body}</div>

            {/* Галочка только у своих реплик: «прочитано» отвечает на вопрос
                «дошёл ли мой ответ», а не «видел ли я чужое сообщение». */}
            {m.author === "staff" && (
              <div className={`bubble__read${m.readAt ? " bubble__read--seen" : ""}`}>
                {m.readAt ? "прочитано" : "доставлено"}
              </div>
            )}
          </div>
        ))}

        {/* Надпись живёт секунды и приходит потоком, а не из ленты: в базе
            её нет и быть не должно. */}
        {typing && (
          <div className="bubble bubble--visitor bubble--typing" aria-live="polite">
            Посетитель печатает…
          </div>
        )}

        <div ref={bottom} />
      </div>

      {data?.status === "closed" ? (
        <p className="admin-hint">
          Разговор закрыт. Если посетитель напишет снова, заведётся новый.
        </p>
      ) : (
        <div className="thread__reply">
          {/* Заготовки — начало ответа, а не ответ: они дописываются в поле,
              и отправляет их человек. Ни одна ничего не обещает — ни срока,
              ни цены: обещание, отправляемое одним щелчком, отправляется
              не читая. */}
          <div className="quick">
            {ЗАГОТОВКИ.map((текст) => (
              <button
                key={текст}
                type="button"
                className="quick__one"
                onClick={() => {
                  setDraft((было) => (было ? `${было} ${текст}` : текст));
                  поле.current?.focus();
                }}
              >
                {текст}
              </button>
            ))}
          </div>

          <textarea
            ref={поле}
            aria-label="Ответ посетителю"
            value={draft}
            placeholder="Ответ посетителю"
            onChange={(e) => {
              setDraft(e.target.value);
              if (e.target.value.trim()) announceTyping();
            }}
            // Enter отправляет, Shift+Enter переносит строку: в переписке
            // сообщения короткие, и тянуться к кнопке на каждое — это лишнее
            // движение сотни раз в день.
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />

          <div className="thread__go">
            <span className="thread__hint mono">
              ENTER — отправить · ответ закрепляет разговор за вами
            </span>
            <button
              className="btn btn--small btn--danger"
              onClick={() => void closeChat(id).then(onDone).catch((e) => setError(message(e)))}
            >
              Закрыть разговор
            </button>
            <button className="btn btn--primary" disabled={sending} onClick={() => void send()}>
              {sending ? "Отправляем…" : "Ответить"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

