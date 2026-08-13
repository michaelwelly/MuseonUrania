"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AnimatedLogo from "@/components/AnimatedLogo";
import { nav, headerCta, site } from "@/content/site";
import styles from "./Header.module.css";

// Клиентский компонент: нужен активный пункт по текущему маршруту и состояние
// мобильного меню. Разметка и размеры — design/VedalHeader.dc.html
// и design/VedalHeaderMobile.dc.html.

function Arrow() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const telHref = `tel:${site.phone.replace(/\s/g, "")}`;

  // «/about» и «/about/» — один и тот же пункт: маршруты со слешем на конце.
  const isActive = (href: string) => {
    const a = pathname.replace(/\/+$/, "");
    const b = href.replace(/\/+$/, "");
    return b !== "" && (a === b || a.startsWith(`${b}/`));
  };

  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <Link href="/" className={styles.brand} aria-label={`${site.brand}, на главную`}>
          {/* 42 — та же высота, что была у статичного знака в .brand img. */}
          <AnimatedLogo height={42} />
        </Link>

        <nav className={styles.nav} aria-label="Основная навигация">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${isActive(item.href) ? styles.navActive : ""}`}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.tools}>
          <a className={styles.phone} href={telHref}>
            <span className={styles.phoneNumber}>{site.phone}</span>
            <span className={styles.phoneHours}>{site.phoneHours}</span>
          </a>

          <a className={styles.iconButton} href={telHref} aria-label="Позвонить">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z" />
            </svg>
          </a>

          <Link className={styles.cta} href={headerCta.href} data-analytics="header_contact_click">
            {headerCta.label}
            <Arrow />
          </Link>

          <button
            type="button"
            className={styles.burger}
            aria-label="Меню"
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
        <nav className={`${styles.menu} ${styles.menuOpen}`} aria-label="Мобильная навигация">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(item.href) ? styles.menuActive : undefined}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            className={`${styles.cta} ${styles.menuCta}`}
            href={headerCta.href}
            onClick={() => setOpen(false)}
          >
            {headerCta.label}
            <Arrow />
          </Link>
        </nav>
      )}
    </header>
  );
}
