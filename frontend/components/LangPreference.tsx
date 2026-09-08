"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { stripLocale, type Lang } from "@/lib/i18n";
import { decideLang, LANG_STORAGE_KEY } from "@/lib/lang-preference";

// Память о языке и автоопределение. Решение принимает `decideLang`,
// здесь остаётся только сходить в хранилище и в адресную строку.
//
// Ничего не рисует. Стоит в оболочке сайта, а не на странице: работать
// должно на всех девяти маршрутах, а не на главной.

export default function LangPreference({ lang }: { lang: Lang }) {
  const pathname = usePathname();

  useEffect(() => {
    // Хранилище бывает недоступно: приватный режим, запрет на сайт,
    // встроенный браузер приложения. Отсутствие памяти о языке — не повод
    // ронять страницу, поэтому чтение и запись в try.
    const read = (): string | null => {
      try {
        return window.localStorage.getItem(LANG_STORAGE_KEY);
      } catch {
        return null;
      }
    };

    const { path } = stripLocale(pathname ?? "/");
    const decision = decideLang(lang, path, read(), navigator.languages ?? [navigator.language]);

    if (decision.kind === "stay") return;

    if (decision.kind === "remember") {
      try {
        window.localStorage.setItem(LANG_STORAGE_KEY, decision.lang);
      } catch {
        // Не запомнили — переживём: язык всё равно виден в адресе.
      }
      return;
    }

    // replace, а не assign: иначе «назад» возвращает на страницу, которая
    // тут же уводит вперёд, и кнопка перестаёт работать.
    window.location.replace(decision.href);
  }, [lang, pathname]);

  return null;
}
