"use client";

import { useState } from "react";
import { STAGE, label } from "../labels";

// Причина отказа.
//
// Требование домена, а не придирка формы: перевод в стадию из `lostStages`
// портал без причины не примет. Спросить её надо до запроса — иначе человек
// нажимает, получает отказ и не понимает, почему сделка осталась на месте.
//
// Одно окно на доску и на карточку сделки: спрашивают они одно и то же,
// и два текста про одно разъезжаются на первой же правке.

export function Reason({
  title,
  stage,
  onCancel,
  onDone,
}: {
  /** Что именно уходит в отказ — человек должен видеть, что не перепутал. */
  title: string;
  stage: string;
  onCancel: () => void;
  onDone: (reason: string) => void;
}) {
  const [text, setText] = useState("");

  return (
    <div
      className="veil"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reason-title"
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      >
        <div className="sheet__head">
          <h2 id="reason-title">Почему {label(STAGE, stage)}?</h2>
        </div>

        <p className="sheet__note">
          «{title}» уходит в отказ. Причина остаётся в карточке сделки и попадает
          в аналитику: без неё через полгода нельзя ответить, почему проигрывают.
        </p>

        <label className="field">
          <span>Причина</span>
          <textarea
            autoFocus
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Дорого · выбрали другого поставщика · отложили закупку"
          />
        </label>

        <div className="row row--end">
          <button type="button" className="btn" onClick={onCancel}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn--danger"
            disabled={!text.trim()}
            onClick={() => onDone(text.trim())}
          >
            Перевести в отказ
          </button>
        </div>
      </div>
    </div>
  );
}
