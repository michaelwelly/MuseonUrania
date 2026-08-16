"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  chatQueue,
  chatThread,
  chatsAll,
  closeChat,
  replyInChat,
  type ChatCard,
  type ChatThread,
  type Page,
} from "@/lib/admin";
import { accessToken } from "@/lib/auth";
import { apiUrl } from "@/lib/submit";
import { Note, message, useLoad, when } from "../ui";

// Разговоры посетителей.
//
// Слева — что делать, справа — сам разговор. Очередь и полный список разведены
// вкладками, а не фильтром: это разные вопросы. «Кому ответить прямо сейчас» —
// работа; «что вообще происходит» — обзор. Смешав их, получаем экран, где
// закрытые разговоры недельной давности стоят вперемешку с ждущими ответа.

const STATUS: Record<string, string> = {
  open: "с Уранией",
  waiting: "ждёт ответа",
  attended: "в работе",
  closed: "закрыт",
};

const BADGE: Record<string, string> = {
  waiting: "badge--warn",
  attended: "badge--on",
  closed: "badge--off",
};

export default function ChatsPage() {
  const [tab, setTab] = useState<"queue" | "all">("queue");
  const [open, setOpen] = useState<string | null>(null);
  // Меняется на каждое событие из потока — по нему перезагружаются и список,
  // и лента. Отдельный счётчик, а не время: время сравнивается неточно, если
  // два события пришли в одну миллисекунду.
  const [beat, setBeat] = useState(0);

  const { data, error, setError } = useLoad<Page<ChatCard>>(
    () => (tab === "queue" ? chatQueue() : chatsAll()),
    `${tab}:${beat}`,
  );

  useLiveUpdates(useCallback(() => setBeat((b) => b + 1), []), setError);

  return (
    <>
      <div className="admin-head">
        <h1>Разговоры</h1>
        <div className="row">
          <button
            className={`btn btn--small${tab === "queue" ? " btn--primary" : ""}`}
            onClick={() => setTab("queue")}
          >
            Ждут ответа
          </button>
          <button
            className={`btn btn--small${tab === "all" ? " btn--primary" : ""}`}
            onClick={() => setTab("all")}
          >
            Все
          </button>
        </div>
      </div>
      <p className="admin-pd">На экране могут быть персональные данные</p>
      <p className="admin-hint">
        Урания отвечает, пока находит ответ по опубликованному. Когда не находит — передаёт
        человеку, и разговор попадает сюда. Ваш ответ и есть взятие разговора: отдельной
        кнопки «взять» нет, потому что взятый и неотвеченный разговор пропадает из очереди,
        а посетитель ждёт ровно так же. С этого момента Урания в разговоре молчит.
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
                  {STATUS[c.status] ?? c.status}
                </span>
                <span className="muted" style={{ fontSize: 12 }}>{when(c.lastAt)}</span>
              </span>
              <span className="chats__where mono">{c.page ?? "—"}</span>
              {c.owner && <span className="muted" style={{ fontSize: 12 }}>{c.owner}</span>}
            </button>
          ))}
        </div>

        <div className="chats__thread">
          {open ? (
            <Thread key={open} id={open} beat={beat} onDone={() => setBeat((b) => b + 1)} />
          ) : (
            <p className="admin-hint">Выберите разговор слева.</p>
          )}
        </div>
      </div>
    </>
  );
}

function Thread({ id, beat, onDone }: { id: string; beat: number; onDone: () => void }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const { data, error, setError } = useLoad<ChatThread>(() => chatThread(id), `${id}:${beat}`);
  const bottom = useRef<HTMLDivElement>(null);

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
              {m.author === "visitor" ? "Посетитель" : m.author === "staff" ? m.actor : "Урания"}
              <span className="muted"> · {when(m.at)}</span>
            </div>
            <div className="bubble__body">{m.body}</div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {data?.status === "closed" ? (
        <p className="admin-hint">
          Разговор закрыт. Если посетитель напишет снова, заведётся новый.
        </p>
      ) : (
        <div className="thread__reply">
          <textarea
            value={draft}
            placeholder="Ответ посетителю"
            onChange={(e) => setDraft(e.target.value)}
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
function useLiveUpdates(onChange: () => void, onError: (message: string | null) => void) {
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

        while (alive) {
          const { done, value } = await reader.read();
          if (done) break;
          // Любая строка данных означает «что-то изменилось»: тела в событии
          // нет намеренно, и разбирать в нём нечего.
          if (decoder.decode(value, { stream: true }).includes("data:")) onChange();
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
  }, [onChange, onError]);
}
