"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "./icons";

// Окно горячих клавиш.
//
// Список здесь ровно тот, что работает. Соблазн выписать весь набор из макета
// велик — окно выглядит богаче, — но клавиша, о которой человек прочитал и
// которая ничего не делает, дороже отсутствующей строки: после первой такой
// он перестаёт верить всему списку и больше сюда не заходит.
//
// Клавиши списков (J и K по строкам, ПРОБЕЛ на выделение, SHIFT+КЛИК на
// диапазон, E на правку) приедут вместе со списками, которые их слушают.
// Про это сказано внизу окна словами, а не пустыми строками.

type Клавиша = { key: string; what: string };

const НАБОР: readonly Клавиша[] = [
  { key: "⌘K / Ctrl+K", what: "Поиск по всему порталу" },
  { key: "?", what: "Это окно" },
  { key: "ESC", what: "Закрыть окно, панель или поиск" },
  { key: "N", what: "Новая сделка" },
  { key: "D", what: "Добавить материал" },
  { key: "G затем C", what: "Клиенты" },
  { key: "G затем L", what: "Заявки" },
  { key: "G затем D", what: "Сделки" },
];

// Окно рисуется оболочкой по флагу, а не прячется стилями: спрятанное окно
// остаётся в дереве, и Tab продолжает ходить по кнопкам, которых не видно.
export function Hotkeys({ onClose }: { onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);

  // Фокус уводится в окно, иначе он остаётся на кнопке в футере: с клавиатуры
  // окно открылось, а Tab продолжает ходить по странице под ним.
  useEffect(() => close.current?.focus(), []);

  return (
    <div
      className="veil"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hotkeys-title"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <div className="sheet__head">
          <h2 id="hotkeys-title">Горячие клавиши</h2>
          <button
            ref={close}
            type="button"
            className="sheet__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <CloseIcon />
          </button>
        </div>

        <dl className="keys">
          {НАБОР.map((k) => (
            <div className="keys__row" key={k.key}>
              <dt className="keys__key mono">{k.key}</dt>
              <dd className="keys__what">{k.what}</dd>
            </div>
          ))}
        </dl>

        <p className="sheet__note">
          Клавиши списков — J и K по строкам, ПРОБЕЛ на выделение, SHIFT+КЛИК на диапазон, E на
          правку — появятся здесь вместе со списками, которые их слушают. Пока их нет, и в этом
          списке их тоже нет.
        </p>
      </div>
    </div>
  );
}
