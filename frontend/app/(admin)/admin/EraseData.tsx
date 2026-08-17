"use client";

import { useState } from "react";
import { message } from "./ui";

// Кнопка «уничтожить персональные данные».
//
// ————— почему в два шага, а не window.confirm —————
//
// Действие необратимо: стёртое имя и стёртую переписку не вернуть ниоткуда,
// кроме бэкапа, который тоже стареет. Системное окно подтверждения для этого
// не годится по трём причинам: его закрывают не читая, оно не может объяснить
// последствия своими словами, и оно не проверяется тестом.
//
// Здесь подтверждение — второе состояние самой кнопки, рядом с текстом о том,
// ЧТО именно исчезнет. Промахнуться мимо неё можно, но не заметить, что
// подтверждаешь, — нет.
//
// ————— почему кнопка не прячется после —————
//
// Обезличенная карточка показывает «данные уничтожены» и дату. Убрать отметку
// совсем значит оставить сотрудника гадать, почему в полях «удалено»: сбой это
// или исполненное обращение.
export default function EraseData({
  what,
  erasedAt,
  erase,
  onDone,
}: {
  /** Что именно исчезнет — своими словами, для этого экрана. */
  what: string;
  /** Когда уничтожено. Пусто — ещё нет. */
  erasedAt?: string | null;
  erase: () => Promise<unknown>;
  onDone: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (erasedAt) {
    return (
      <p className="erase erase--done">
        Персональные данные уничтожены {new Date(erasedAt).toLocaleDateString("ru-RU")}.
      </p>
    );
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await erase();
      onDone();
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }

  return (
    <div className="erase">
      {error && <p className="note note--error">{error}</p>}

      {asking ? (
        <>
          <p className="erase__warn">
            Будет уничтожено безвозвратно: {what}. Отменить нельзя — восстановить можно
            только из бэкапа, если он ещё есть.
          </p>
          <div className="row">
            <button className="btn btn--small" disabled={busy} onClick={() => setAsking(false)}>
              Отмена
            </button>
            <button className="btn btn--danger btn--small" disabled={busy} onClick={() => void run()}>
              {busy ? "Уничтожаем…" : "Да, уничтожить"}
            </button>
          </div>
        </>
      ) : (
        <button className="btn btn--danger btn--small" onClick={() => setAsking(true)}>
          Уничтожить персональные данные
        </button>
      )}
    </div>
  );
}
