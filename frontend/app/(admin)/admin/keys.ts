"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Клавиши оболочки.
//
// Одно место, а не слушатель в каждом компоненте: иначе `?` открывает окно
// горячих клавиш и одновременно печатается в поле поиска, а Escape закрывает
// сразу и панель, и окно под ней.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему одиночные буквы вообще возможны
//
// Потому что проверяется, где стоит фокус. Клавиша без модификатора — это
// буква, и в поле ввода она обязана оставаться буквой. Без этой проверки
// «Новосибирск» в поле города открывает новую сделку на букве N, а «где»
// в примечании к КП уводит в сделки на G+D.
//
// Сочетание с модификатором проверки не требует: ⌘K не набирается ни в одном
// поле, и работать оно должно везде.
//
// ───────────────────────────────────────────────────────────────────────────
// Аккорд G
//
// G — не действие, а приставка: следующая буква говорит куда. Ожидание
// ограничено полутора секундами, иначе G, нажатая случайно утром, уводит
// в клиентов от буквы C, набранной в обед.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему клавиша ищется по `code`, а не по `key`
//
// Потому что админка русская. На русской раскладке `key` у той же клавиши —
// «т», «в», «п», «л», и сравнение с латинской буквой не совпадает никогда.
// Замер это и поймал: ⌘K, N и аккорд G не работали вовсе, пока человек
// не переключал раскладку, — а он её не переключает, он пишет по-русски.
//
// `code` называет физическую клавишу и от раскладки не зависит. `key`
// оставлен вторым условием: на раскладке, где буквы переставлены нарочно,
// человек ищет букву, а не место на клавиатуре.

type Крючки = {
  onPalette: () => void;
  onHotkeys: () => void;
  /** Закрыть всё открытое. Работает и когда фокус стоит в поле поиска. */
  onEscape: () => void;
  /** Пока открыто хоть одно окно, одиночные буквы не работают. */
  busy: boolean;
};

const АККОРД: readonly [string, string][] = [
  ["c", "/admin/clients/"],
  ["l", "/admin/leads/"],
  ["d", "/admin/deals/"],
];

const ОЖИДАНИЕ = 1500;

/**
 * Нажата ли названная латинская буква — в любой раскладке.
 *
 * `code` — физическая клавиша: «KeyN» и на русской, и на английской.
 * `key` — то, что напечаталось бы: на раскладке с переставленными буквами
 * человек ищет глазами букву, а не место.
 */
function буква(e: KeyboardEvent, letter: string): boolean {
  return e.code === `Key${letter.toUpperCase()}` || e.key.toLowerCase() === letter;
}

export function useShellKeys({ onPalette, onHotkeys, onEscape, busy }: Крючки) {
  const router = useRouter();
  const chord = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ждём_букву = useRef(false);

  // Крючки меняются на каждом рендере оболочки. Слушатель, пересобираемый
  // так же часто, снимался и вешался бы по десять раз за секунду ввода —
  // держим их в ссылке, а слушатель ставится один раз.
  //
  // Ссылка правится эффектом, а не в теле: запись во время отрисовки —
  // это состояние, изменённое до того, как React решил, что отрисовка
  // состоялась. При отброшенной попытке ссылка осталась бы от неё.
  const свежие = useRef<Крючки>({ onPalette, onHotkeys, onEscape, busy });
  useEffect(() => {
    свежие.current = { onPalette, onHotkeys, onEscape, busy };
  });

  useEffect(() => {
    const снять_аккорд = () => {
      ждём_букву.current = false;
      if (chord.current) clearTimeout(chord.current);
      chord.current = null;
    };

    const слушатель = (e: KeyboardEvent) => {
      const { onPalette, onHotkeys, onEscape, busy } = свежие.current;

      // Escape закрывает открытое раньше всех проверок, в том числе проверки
      // фокуса: набранное в поле поиска — часть открытого окна, и закрывать
      // его надо оттуда же, где человек печатает.
      if (e.key === "Escape") {
        if (busy) {
          e.preventDefault();
          onEscape();
        }
        снять_аккорд();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && буква(e, "k")) {
        e.preventDefault();
        снять_аккорд();
        onPalette();
        return;
      }

      // Дальше — одиночные буквы. Всё, что с модификатором, чужое.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (busy || печатает(e.target)) return;

      if (ждём_букву.current) {
        const куда = АККОРД.find(([letter]) => буква(e, letter))?.[1];
        снять_аккорд();
        if (куда) {
          e.preventDefault();
          router.push(куда);
        }
        return;
      }

      if (буква(e, "g")) {
        e.preventDefault();
        ждём_букву.current = true;
        if (chord.current) clearTimeout(chord.current);
        chord.current = setTimeout(снять_аккорд, ОЖИДАНИЕ);
        return;
      }

      // Вопросительный знак ищется по `key`: это не буква, и физической
      // клавиши у него нет — на русской раскладке он живёт на «7».
      if (e.key === "?") {
        e.preventDefault();
        onHotkeys();
        return;
      }

      if (буква(e, "n")) {
        e.preventDefault();
        router.push("/admin/deals/new");
        return;
      }

      if (буква(e, "d")) {
        e.preventDefault();
        router.push("/admin/news/new");
      }
    };

    document.addEventListener("keydown", слушатель);
    return () => {
      document.removeEventListener("keydown", слушатель);
      снять_аккорд();
    };
  }, [router]);
}

/**
 * Человек печатает, а не командует.
 *
 * `isContentEditable` проверяется отдельно от имени тега: панель кнопок
 * в форме материала — это `div` с правкой, и тега `textarea` у неё нет.
 */
function печатает(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const тег = target.tagName;
  return тег === "INPUT" || тег === "TEXTAREA" || тег === "SELECT";
}
