"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CloseIcon } from "./icons";
import { message } from "./ui";

// Полоса-сообщение с отменой.
//
// Зачем отмена, а не подтверждение. Снятие изделия с публикации, передача
// дежурства и удаление черновика — действия одного нажатия, и спрашивать
// «вы уверены?» перед каждым значит приучить человека жать «да» не читая.
// Дешевле сделать действие сразу и оставить путь назад на семь секунд:
// промах виден на экране, а не в журнале.
//
// Почему семь. Меньше пяти — человек не успевает прочитать фразу и понять,
// что промахнулся. Больше десяти — полоса начинает жить своей жизнью и
// перекрывает содержимое. Семь секунд — та же выдержка, что у полосы
// согласия на сайте.
//
// Отправка КП отмены не имеет: письмо ушло, и вернуть его портал не может.
// Полоса в этом случае показывается без кнопки — сообщением, а не выбором.

type Undo = () => void | Promise<unknown>;

type Shown = {
  /** Растёт на каждом показе: по нему перезапускается выдержка. */
  key: number;
  text: string;
  undo: Undo | null;
  /** Отмена не удалась — на её месте причина, а не кнопка по второму кругу. */
  failed: string | null;
};

type Show = (text: string, undo?: Undo) => void;

const Bar = createContext<Show>(() => {});

/**
 * Показать полосу-сообщение.
 *
 * Возвращает функцию, а не объект: у полосы одно действие, и оборачивать его
 * в `{ show }` значит заставить каждую страницу писать лишнюю строку.
 */
export function useToast(): Show {
  return useContext(Bar);
}

const ВЫДЕРЖКА = 7000;

export function ToastHost({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const [busy, setBusy] = useState(false);
  const счёт = useRef(0);

  const show = useCallback<Show>((text, undo) => {
    счёт.current += 1;
    setBusy(false);
    setShown({ key: счёт.current, text, undo: undo ?? null, failed: null });
  }, []);

  // Выдержка перезапускается ключом показа, а не текстом: два одинаковых
  // сообщения подряд — обычное дело («снято с публикации» дважды), и второе
  // должно висеть свои семь секунд, а не доживать чужие.
  const key = shown?.key;
  useEffect(() => {
    if (key === undefined) return;
    const timer = setTimeout(() => setShown(null), ВЫДЕРЖКА);
    return () => clearTimeout(timer);
  }, [key]);

  const отменить = useCallback(async () => {
    const undo = shown?.undo;
    if (!undo || busy) return;
    setBusy(true);
    try {
      await undo();
      setShown(null);
    } catch (e) {
      // Отменить не вышло — портал отказал. Кнопка исчезает: второе нажатие
      // отказало бы так же, а человеку нужно знать причину, а не пробовать.
      setBusy(false);
      setShown((was) => (was ? { ...was, undo: null, failed: message(e) } : was));
    }
  }, [shown, busy]);

  return (
    <Bar.Provider value={show}>
      {children}

      {/* role="status" вместо alert: полоса сообщает об уже случившемся, и
          перебивать ею чтение экрана незачем. */}
      <div className="toast-slot" role="status" aria-live="polite">
        {shown && (
          <div className="toast" key={shown.key}>
            <span className="toast__dot" aria-hidden="true" />
            <span className="toast__text">{shown.failed ?? shown.text}</span>

            {shown.undo && (
              <button type="button" className="toast__undo" onClick={отменить} disabled={busy}>
                {busy ? "Отменяем…" : "Отменить"}
              </button>
            )}

            <button
              type="button"
              className="toast__close"
              onClick={() => setShown(null)}
              aria-label="Закрыть сообщение"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        )}
      </div>
    </Bar.Provider>
  );
}
