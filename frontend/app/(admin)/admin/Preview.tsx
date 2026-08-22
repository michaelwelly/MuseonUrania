"use client";

import { useEffect, useRef } from "react";
import { ArrowIcon } from "./icons";

// Предпросмотр: так это увидит посетитель.
//
// Нужен ровно потому, что неопубликованного на сайте нет. Опубликованное
// можно открыть по адресу и посмотреть по-настоящему — черновик по своему
// адресу отдаёт 404, и увидеть его до публикации больше негде.
//
// ───────────────────────────────────────────────────────────────────────────
// Чего здесь нет и почему
//
// Шапки сайта. В макете она воспроизведена внутри окна — знак, семь пунктов
// меню, телефон, зелёная кнопка. Второй экземпляр шапки живёт своей жизнью:
// в шапке сайта поменяют пункт, здесь не поменяют, и предпросмотр начнёт
// показывать сайт, которого нет. Разница между «похоже» и «так и есть» тут
// и есть весь смысл.
//
// Вместо неё — адрес будущей страницы и, у опубликованного, ссылка открыть
// её по-настоящему. Настоящая страница честнее любой её копии.
//
// Набор здесь тот же, что на сайте: заголовок Unbounded, текст 17 пикселей
// в колонку 68 знаков. Именно ширина колонки и кегль решают, как материал
// читается, — и именно их редактор проверяет, глядя сюда.

export function Preview({
  address,
  live,
  children,
  onClose,
}: {
  /** Адрес будущей страницы: `/news/first-post`. */
  address: string;
  /** Опубликовано — значит по адресу что-то есть, и туда можно сходить. */
  live: boolean;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => close.current?.focus(), []);

  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);

  return (
    <div
      className="veil veil--paper"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="look" role="dialog" aria-modal="true" aria-label="Предпросмотр">
        <div className="look__bar">
          <span className="look__what mono">Предпросмотр · так это увидит посетитель</span>
          <span className="look__address mono">{address}</span>

          {live ? (
            <a className="look__live" href={address} target="_blank" rel="noreferrer">
              Открыть на сайте
              <ArrowIcon size={13} />
            </a>
          ) : (
            <span className="look__draft mono">черновика по этому адресу ещё нет</span>
          )}

          <button ref={close} type="button" className="look__close" onClick={onClose}>
            Закрыть · ESC
          </button>
        </div>

        <div className="look__sheet">{children}</div>

        <p className="look__foot">
          Цены, сроки поставки и клинические заявления на сайт не выносятся. Незаполненное
          посетитель увидит как «ожидает уточнения» — ровно так, как это стоит здесь.
        </p>
      </div>
    </div>
  );
}
