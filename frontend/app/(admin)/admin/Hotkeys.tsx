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

// `where` — куда клавиша ведёт. Он же решает, показывать ли строку:
// список обязан совпадать с тем, что у этого человека работает, а
// клавиши навигации у ролей разные (issue #96). Без `where` — клавиша
// без перехода, она работает у всех.
type Клавиша = { key: string; what: string; where?: string };

const НАБОР: readonly Клавиша[] = [
  { key: "⌘K / Ctrl+K", what: "Поиск по всему порталу" },
  { key: "?", what: "Это окно" },
  { key: "ESC", what: "Закрыть окно, панель или поиск" },
  { key: "N", what: "Новая сделка", where: "/admin/deals/new" },
  { key: "D", what: "Добавить материал", where: "/admin/news/new" },
  { key: "G затем C", what: "Клиенты", where: "/admin/clients/" },
  { key: "G затем L", what: "Заявки", where: "/admin/leads/" },
  { key: "G затем D", what: "Сделки", where: "/admin/deals/" },
  { key: "J / K", what: "По строкам списка вниз и вверх", where: "/admin/leads/" },
  { key: "ПРОБЕЛ", what: "Выделить строку под курсором", where: "/admin/leads/" },
  { key: "SHIFT+КЛИК", what: "Выделить всё до этой строки", where: "/admin/leads/" },
  { key: "ENTER", what: "Открыть строку под курсором", where: "/admin/leads/" },
];

// Окно рисуется оболочкой по флагу, а не прячется стилями: спрятанное окно
// остаётся в дереве, и Tab продолжает ходить по кнопкам, которых не видно.
export function Hotkeys({
  onClose,
  mayGo,
}: {
  onClose: () => void;
  /** Пущен ли этот человек туда, куда ведёт клавиша. */
  mayGo: (path: string) => boolean;
}) {
  const close = useRef<HTMLButtonElement>(null);

  // Строки чужого контура не показываются: у производства это были ЧЕТЫРЕ
  // клавиши из двенадцати, и все четыре приводили к «Раздел закрыт».
  const мои = НАБОР.filter((k) => k.where === undefined || mayGo(k.where));
  const естьСписки = мои.some((k) => k.where === "/admin/leads/");

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
          {мои.map((k) => (
            <div className="keys__row" key={k.key}>
              <dt className="keys__key mono">{k.key}</dt>
              <dd className="keys__what">{k.what}</dd>
            </div>
          ))}
        </dl>

        {естьСписки && (
          <p className="sheet__note">
            Четыре последние работают там, где есть список строк, — пока это заявки. На остальных
            экранах они молчат, а не делают что-то другое. E на правку появится вместе
            с продукцией и новостями.
          </p>
        )}
      </div>
    </div>
  );
}
