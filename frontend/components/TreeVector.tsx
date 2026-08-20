"use client";

import { useEffect, useRef } from "react";

/**
 * Знак-дерево вектором, без движения. Маркировочный знак на «О компании»
 * и «Производстве».
 *
 * Рисуется той же библиотекой, что и рост на загрузочном экране, но
 * перемотанной в конец: последний кадр совпадает с исходным знаком пиксель
 * в пиксель. Так у дерева на сайте одна форма и один источник — раньше
 * анимация и статичный знак жили в разных файлах и разошлись бы при первой
 * же правке артворка.
 *
 * Движения здесь нет намеренно. Маркировочный знак стоит в тексте страницы
 * рядом с абзацем, и прорастающее дерево посреди чтения отвлекает; на
 * загрузочном экране оно уместно, потому что там больше ничего нет.
 */

const GREEN = "#149c3c";

export default function TreeVector({ size = 96 }: { size?: number }) {
  const host = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    let cancelled = false;

    // Динамический импорт по той же причине, что в TreeGrow: библиотека —
    // IIFE, обращается к window при выполнении, и обычный импорт наверху
    // файла роняет пререндер страницы.
    void import("@/vendor/tree-growth.js").then(() => {
      if (cancelled || !window.treeGrowth) return;
      const handle = window.treeGrowth(el, { color: GREEN, autoplay: false });
      handle.seek(handle.duration);
    });

    return () => {
      cancelled = true;
      el.replaceChildren();
    };
  }, []);

  return (
    <span
      ref={host}
      style={{ display: "block", width: size, height: size }}
      aria-hidden="true"
    />
  );
}
