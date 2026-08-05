import Link from "next/link";
import Image from "next/image";
import { nav, headerCta, site } from "@/content/site";
import styles from "./Header.module.css";

// Шапка по макету заказчика: логотип, навигация, телефон с часами работы,
// кнопка «Связаться с нами». Иконки поиска в макете нет, хотя
// docs/frontend/sitemap.md её упоминает — следуем макету.
// Навигация на <a>: маршруты, кроме «/», ещё не созданы.
export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label={`${site.brand}, на главную`}>
          <Image
            src={site.logo.src}
            alt={site.brand}
            width={site.logo.width}
            height={site.logo.height}
            priority
          />
        </Link>

        <nav className={styles.nav} aria-label="Основная навигация">
          {nav.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <a className={styles.phone} href={`tel:${site.phone.replace(/\s/g, "")}`}>
          <svg
            className={styles.phoneIcon}
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z" />
          </svg>
          <span>
            <span className={styles.phoneNumber}>{site.phone}</span>
            <span className={styles.phoneHours}>{site.phoneHours}</span>
          </span>
        </a>

        <a
          className={styles.cta}
          href={headerCta.href}
          data-analytics="header_contact_click"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect
              x="2.5"
              y="4.5"
              width="19"
              height="15"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="m3 6 9 6.5L21 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {headerCta.label}
        </a>
      </div>
    </header>
  );
}
