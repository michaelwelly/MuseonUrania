"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
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
import { accessToken } from "@/lib/auth";
import { apiUrl } from "@/lib/submit";
import EraseData from "../EraseData";
import { CHAT_STATUS, label } from "../labels";
import { Note, message, useLoad, when } from "../ui";

// Разговоры посетителей.
//
// Слева — что делать, справа — сам разговор. Очередь и полный список разведены
// вкладками, а не фильтром: это разные вопросы. «Кому ответить прямо сейчас» —
// работа; «что вообще происходит» — обзор. Смешав их, получаем экран, где
// закрытые разговоры недельной давности стоят вперемешку с ждущими ответа.

const BADGE: Record<string, string> = {
  waiting: "badge--warn",
  attended: "badge--on",
  closed: "badge--off",
};

// Разговор адресуем: `/admin/chats/?id=…` открывает ленту сразу.
//
// Понадобилось виджету в оболочке — его карточка должна вести в этот же
// раздел на этом же разговоре, — но польза шире: разговор стал вещью,
// на которую можно дать ссылку в переписке между сотрудниками. До этого
// «посмотри вон тот» означало «открой раздел и ищи глазами».
//
// Suspense обязателен: без границы useSearchParams уводит страницу
// в отрисовку на клиенте целиком, и сборка об этом предупреждает.
export default function ChatsPage() {
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
  // только тех, кому Ведалина не смогла ответить. Разговор, который идёт прямо
  // сейчас и по которому она справляется, в неё не попадает — и экран,
  // сделанный чтобы видеть посетителей вживую, ровно их и прятал.
  //
  // Очередь никуда не делась, она соседней вкладкой: «кому надо ответить» —
  // по-прежнему отдельный вопрос. Но первым ответом на вопрос «что сейчас
  // происходит» должно быть «вот что происходит».
  const [tab, setTab] = useState<"all" | "queue">("all");
  // Разговор из адреса — только начальное значение: дальше выбор ведёт
  // состояние. Иначе кнопка «назад» в браузере возвращала бы не на прошлый
  // разговор, а на прошлый адрес, и они разъехались бы на первом же щелчке.
  const [open, setOpen] = useState<string | null>(() => params.get("id"));
  // Меняется на каждое событие из потока — по нему перезагружаются и список,
  // и лента. Отдельный счётчик, а не время: время сравнивается неточно, если
  // два события пришли в одну миллисекунду.
  const [beat, setBeat] = useState(0);

  const { data, error, setError } = useLoad<Page<ChatCard>>(
    () => (tab === "queue" ? chatQueue() : chatsAll()),
    `${tab}:${beat}`,
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

  useLiveUpdates(useCallback(() => setBeat((b) => b + 1), []), onTyping, setError);

  return (
    <>
      <div className="admin-head">
        <h1>Разговоры</h1>
        <div className="row">
          {/* Порядок кнопок повторяет порядок вопросов: сначала «что сейчас
              происходит», потом «кому надо ответить». */}
          <button
            className={`btn btn--small${tab === "all" ? " btn--primary" : ""}`}
            onClick={() => setTab("all")}
          >
            Все разговоры
          </button>
          <button
            className={`btn btn--small${tab === "queue" ? " btn--primary" : ""}`}
            onClick={() => setTab("queue")}
          >
            Ждут ответа
          </button>
        </div>
      </div>
      <p className="admin-pd">На экране могут быть персональные данные</p>
      <p className="admin-hint">
        Здесь видно все разговоры, свежие сверху — в том числе те, где Ведалина справляется
        сама. Оранжевым помечены те, кто ждёт живого ответа: их же отдельно собирает вкладка
        рядом. Ваш ответ и есть взятие разговора — отдельной кнопки «взять» нет, потому что
        взятый и неотвеченный разговор пропадает из очереди, а посетитель ждёт ровно так же.
        С этого момента Ведалина в разговоре молчит.
      </p>

      <Note kind="error">{error}</Note>

      <div className="chats">
        <div className="chats__list">
          {data?.items.length === 0 && (
            <p className="admin-hint">
              {tab === "queue" ? "Никто не ждёт ответа." : "Разговоров пока не было."}
            </p>
          )}
          {data?.items.map((c) => (
            <button
              key={c.id}
              className={`chats__row${open === c.id ? " chats__row--open" : ""}`}
              onClick={() => setOpen(c.id)}
            >
              <span className="row" style={{ justifyContent: "space-between" }}>
                <span className={`badge ${BADGE[c.status] ?? ""}`}>
                  {label(CHAT_STATUS, c.status)}
                </span>
                <span className="muted" style={{ fontSize: "var(--t-small)" }}>{when(c.lastAt)}</span>
              </span>
              <span className="chats__where mono">{c.page ?? "—"}</span>
              {c.owner && <span className="muted" style={{ fontSize: "var(--t-small)" }}>{c.owner}</span>}
            </button>
          ))}
        </div>

        <div className="chats__thread">
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
        </div>
      </div>
    </>
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
          <textarea
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
          <div className="row row--end" style={{ marginTop: 0 }}>
            <button
              className="btn btn--danger btn--small"
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

      {/* Обращение по переписке исполняется здесь: посетитель мог написать
          своё имя и телефон прямо в чат, и обычно именно так и делает. */}
      <EraseData
        what="тексты всех сообщений — и посетителя, и Ведалины, и сотрудника"
        erase={() => eraseChatData(id)}
        onDone={onDone}
      />
    </>
  );
}

/**
 * Живые обновления.
 *
 * EventSource здесь не годится: он не умеет слать заголовок, а админская дверь
 * без токена не пускает. Класть токен в адрес нельзя — адреса оседают в логах
 * прокси и в истории браузера. Поэтому поток читается обычным `fetch`
 * с заголовком, а разбор формата — три строки: событий одного вида, и в них
 * нет ничего, кроме идентификатора разговора.
 */
function useLiveUpdates(
  onChange: () => void,
  onTyping: (conversationId: string) => void,
  onError: (message: string | null) => void,
) {
  useEffect(() => {
    if (!apiUrl) return;
    const abort = new AbortController();
    let alive = true;

    (async () => {
      try {
        const token = await accessToken();
        if (!token || !alive) return;

        const response = await fetch(`${apiUrl}/api/admin/v1/chats/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abort.signal,
        });
        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Кусок может прийти разрезанным посередине события, поэтому хвост
        // без завершающей пустой строки остаётся до следующего чтения.
        let tail = "";

        while (alive) {
          const { done, value } = await reader.read();
          if (done) break;

          tail += decoder.decode(value, { stream: true });
          const events = tail.split("\n\n");
          tail = events.pop() ?? "";

          for (const event of events) {
            if (!event.includes("data:")) continue;

            if (event.includes("event:typing")) {
              // Событие несёт разговор и того, кто печатает. Нас интересует
              // только посетитель: «сотрудник печатает» — это мы сами.
              const data = event.slice(event.indexOf("data:") + 5).trim();
              try {
                const parsed = JSON.parse(data) as { conversationId: string; who: string };
                if (parsed.who === "visitor") onTyping(parsed.conversationId);
              } catch {
                // Событие незнакомого вида — не повод рвать поток.
              }
              continue;
            }

            onChange();
          }
        }
      } catch (e) {
        // Обрыв при уходе со страницы — не ошибка.
        if (alive && !(e instanceof DOMException && e.name === "AbortError")) {
          onError("Живое обновление отключилось, список обновляется по действию.");
        }
      }
    })();

    return () => {
      alive = false;
      abort.abort();
    };
  }, [onChange, onTyping, onError]);
}
