"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AnimatedLogo from "@/components/AnimatedLogo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { nav, headerCta, site } from "@/content/site";
import { ui } from "@/content/ui";
import { localePath, stripLocale, type Lang } from "@/lib/i18n";
import styles from "./Header.module.css";

// Клиентский компонент: нужен активный пункт по текущему маршруту и состояние
// мобильного меню. Разметка и размеры — design/VedalHeader.dc.html
// и design/VedalHeaderMobile.dc.html.
//
// Язык приходит пропом из оболочки, а не выводится из адреса: у русской
// версии префикса нет, и по одному только `usePathname` она неотличима от
// адреса с неизвестным первым сегментом.

function Arrow() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export default function Header({ lang }: { lang: Lang }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const telHref = `tel:${site.phone.replace(/\s/g, "")}`;
  const bar = useRef<HTMLElement>(null);
  const strings = ui(lang);

  // Шапка сама сообщает свою высоту в `--header-h`.
  //
  // Числом в CSS это уже стояло — и было неверным. Шапка не одна полоса:
  // над навигацией идёт строка с телефоном, на узком экране всё
  // перестраивается, а при открытом мобильном меню высота меняется вовсе.
  // Записанные руками 78px давали 135 на живом экране, и окно чата,
  // считавшее от них свою высоту, залезало под шапку — заметно это было
  // только глазами.
  //
  // Наблюдатель, а не разовый замер: высота меняется от ширины окна,
  // от открытого меню и от шрифта, который догрузился позже.
  useEffect(() => {
    const node = bar.current;
    if (!node) return;

    const tell = () =>
      document.documentElement.style.setProperty(
        "--header-h",
        `${Math.round(node.getBoundingClientRect().height)}px`,
      );

    tell();
    const watch = new ResizeObserver(tell);
    watch.observe(node);
    return () => watch.disconnect();
  }, []);

  // Сравниваем путь БЕЗ языкового префикса: на `/en/about/` активным должен
  // быть тот же пункт, что на `/about/`. Сравнение с полным адресом
  // не находило бы активным ничего ни на одной переведённой странице.
  //
  // «/about» и «/about/» — один и тот же пункт: маршруты со слешем на конце.
  const { path } = stripLocale(pathname ?? "/");
  const isActive = (href: string) => {
    const a = path.replace(/\/+$/, "");
    const b = href.replace(/\/+$/, "");
    return b !== "" && (a === b || a.startsWith(`${b}/`));
  };

  return (
    <header className={styles.header} ref={bar}>
      <div className={styles.bar}>
        <Link
          href={localePath(lang, "/")}
          className={styles.brand}
          aria-label={strings.header.brandHome}
        >
          {/* 60 — размер из пакета передачи логотипа. Шапка 78px высотой,
              то есть по 9px воздуха сверху и снизу. */}
          <AnimatedLogo height={60} />
        </Link>

        <nav className={styles.nav} aria-label={strings.header.mainNav}>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={localePath(lang, item.href)}
              className={`${styles.navLink} ${isActive(item.href) ? styles.navActive : ""}`}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {strings.nav[item.key]}
            </Link>
          ))}
        </nav>

        <div className={styles.tools}>
          <LanguageSwitcher lang={lang} />

          <a className={styles.phone} href={telHref}>
            <span className={styles.phoneNumber}>{site.phone}</span>
            <span className={styles.phoneHours}>{strings.header.hours}</span>
          </a>

          <a className={styles.iconButton} href={telHref} aria-label={strings.header.call}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z" />
            </svg>
          </a>

          <Link
            className={styles.cta}
            href={localePath(lang, headerCta.href)}
            data-analytics="header_contact_click"
          >
            {strings.header.cta}
            <Arrow />
          </Link>

          <button
            type="button"
            className={styles.burger}
            aria-label={strings.header.menu}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={styles.burgerLines} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <nav className={`${styles.menu} ${styles.menuOpen}`} aria-label={strings.header.mobileNav}>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={localePath(lang, item.href)}
              className={isActive(item.href) ? styles.menuActive : undefined}
              onClick={() => setOpen(false)}
            >
              {strings.nav[item.key]}
            </Link>
          ))}
          <Link
            className={`${styles.cta} ${styles.menuCta}`}
            href={localePath(lang, headerCta.href)}
            onClick={() => setOpen(false)}
          >
            {strings.header.cta}
            <Arrow />
          </Link>
        </nav>
      )}
    </header>
  );
}
