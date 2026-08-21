"use client";

import { useEffect, useRef } from "react";
import { BellIcon } from "./icons";

// Колокол.
//
// В макете под ним лента: «НОВОЕ С 08:00», три события с цветной точкой,
// кнопка «Прочитано». Портал такой ленты не отдаёт — и это не «ещё не
// подключили дверь», а отсутствующее понятие: у события в журнале нет
// адресата, нет признака прочитанности и нет правила, кого именно оно
// касается. Журнал отвечает на вопрос «кто что сделал», а не «что нового
// лично для вас».
//
// Отсюда две возможности. Нарисовать три правдоподобные строки — и получить
// интерфейс, который врёт рядом с настоящими суммами сделок. Или оставить
// колокол на месте и сказать, чего не хватает, чтобы лента появилась.
// Выбрана вторая: правила контента этого проекта запрещают правдоподобную
// выдумку прямо, и уведомления здесь не исключение.
//
// Счётчика на колоколе нет по той же причине: цифра — тоже утверждение.
//
// Чтобы лента заработала, порталу нужны три вещи, которых у него нет:
// адресат события, отметка о прочтении и правило подписки (на свои заявки,
// на свои сделки, на разговоры дежурства). Это дверь `/api/admin/v1/inbox`
// и таблица под неё, а не поле в существующей.

export function Bell({ open, onToggle }: { open: boolean; onToggle: (open: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);

  // Закрытие щелчком мимо и по ESC. Без первого панель остаётся висеть,
  // когда человек ушёл работать в таблицу под ней.
  useEffect(() => {
    if (!open) return;

    const мимо = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onToggle(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && onToggle(false);

    document.addEventListener("mousedown", мимо);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", мимо);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onToggle]);

  return (
    <div className="bell" ref={box}>
      <button
        type="button"
        className="bell__button"
        aria-label="Уведомления"
        aria-expanded={open}
        onClick={() => onToggle(!open)}
      >
        <BellIcon size={19} />
      </button>

      {open && (
        <div className="bell__panel" role="dialog" aria-label="Уведомления">
          <p className="bell__title mono">Уведомления</p>
          <p className="bell__wait">Ожидает уточнения</p>
          <p className="bell__why">
            Портал не хранит уведомлений: у события в журнале нет адресата и нет отметки
            о прочтении. Показать здесь можно только выдуманное, а выдуманному в закрытом
            контуре не место.
          </p>
          <p className="bell__why">
            Что ждёт ответа прямо сейчас, видно в двух местах и по-настоящему: разговоры —
            в виджете внизу справа, остальное — в сводке, в списке «Требует внимания».
          </p>
        </div>
      )}
    </div>
  );
}
