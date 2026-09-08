"use client";

import { usePathname } from "next/navigation";
import { ui } from "@/content/ui";
import {
  htmlLang,
  langName,
  langShort,
  localePath,
  PUBLISHED_LANGS,
  stripLocale,
  type Lang,
} from "@/lib/i18n";
import { LANG_STORAGE_KEY } from "@/lib/lang-preference";
import styles from "./LanguageSwitcher.module.css";

// Переключатель языка.
//
// Обычные ссылки, а не next/link и не кнопки. Причины две, и обе важные.
//
// Первая: у русской и у переведённых версий разные корневые layout'ы
// (`app/(site)` и `app/(intl)/[lang]`), а переход между корневыми layout'ами
// Next всё равно делает полной перезагрузкой. Ссылка честно показывает это
// поведение, а next/link создавал бы вид клиентского перехода.
//
// Вторая: ссылку видно поисковику и работает она без JS. Переключатель —
// единственный способ сменить язык у того, кто пришёл на русскую версию
// и не хочет ждать автоопределения.

export default function LanguageSwitcher({ lang }: { lang: Lang }) {
  const pathname = usePathname();

  // Переключать не из чего — переключателя нет. Пустая навигация с меткой
  // «Язык» не безобидна: скринридер объявляет область, в которой ничего
  // не выбирается, а зрячий видит одинокую надпись «RU», которая выглядит
  // как сломанный список.
  if (PUBLISHED_LANGS.length < 2) return null;
  const { path } = stripLocale(pathname ?? "/");
  const strings = ui(lang);

  // Выбор человека сильнее автоопределения — и старше него по времени
  // жизни: он должен пережить перезагрузку. Пишем до перехода, потому
  // что после перехода этого кода уже не будет.
  const remember = (chosen: Lang) => {
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, chosen);
    } catch {
      // Приватный режим или запрет на хранилище: язык всё равно сменится,
      // просто не запомнится.
    }
  };

  return (
    <nav className={styles.switcher} aria-label={strings.language.label}>
      {PUBLISHED_LANGS.map((item) => {
        const active = item === lang;
        return (
          <a
            key={item}
            className={`${styles.item} ${active ? styles.active : ""}`}
            href={localePath(item, path)}
            hrefLang={htmlLang[item]}
            // Название языка — на нём самом: тот, кто ищет свой, узнаёт его
            // и не читая остального. Поэтому же lang на самой ссылке.
            lang={htmlLang[item]}
            aria-current={active ? "true" : undefined}
            title={langName[item]}
            onClick={() => remember(item)}
          >
            {langShort[item]}
          </a>
        );
      })}
    </nav>
  );
}
