"use client";

import { useEffect, useRef, useState } from "react";
import {
  chatThread,
  closeChat,
  pingTypingInChat,
  replyInChat,
  type ChatThread as Лента,
} from "@/lib/admin";
import { Note, message, useLoad, when } from "./ui";

// Лента разговора: переписка, поле ответа, заготовки, закрытие.
//
// Вынесена из раздела «Разговоры» в отдельный файл, чтобы её можно было
// показать и в виджете. Причина не в красоте: посетитель ждёт ответа прямо
// сейчас, а менеджер, правивший сделку, до этого уходил из карточки в раздел
// и терял место, на котором работал.
//
// Второй реализации не заводили намеренно — здесь отметка о прочтении,
// оценка ответа Ведалины, «печатает», заготовки и Enter как отправка.
// Две копии этого разошлись бы на первой же правке.

const ЗАГОТОВКИ = [
  "Здравствуйте! Сейчас посмотрю и вернусь с ответом.",
  "Уточните, пожалуйста, модель и задачу — так отвечу точнее.",
  "Передаю вопрос инженеру, ответим в этом же окне.",
];

export default function Thread({
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
  const { data, error, setError } = useLoad<Лента>(() => chatThread(id), `${id}:${beat}`);
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

            {/* Оценка ответа Ведалины. Здесь она нужнее, чем где-либо:
                журнал показывает, когда ассистент промолчал, и не показывает
                худшего — он ответил уверенно и не по делу. Помеченный ответ
                виден прямо в переписке, вместе с вопросом, на который он был.

                Молчание большинства не показывается: не оценили — обычное
                дело, и значка «оценки нет» под каждой репликой быть не должно. */}
            {m.author === "assistant" && m.helpful !== null && (
              <div className={`bubble__rated${m.helpful ? "" : " bubble__rated--bad"}`}>
                {m.helpful ? "посетитель: помогло" : "посетитель: не помогло"}
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

