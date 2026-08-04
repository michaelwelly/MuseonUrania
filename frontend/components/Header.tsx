import Link from "next/link";
import { nav, hero, site } from "@/content/site";
import styles from "./Header.module.css";

// Постоянные элементы шапки — docs/frontend/sitemap.md → Persistent elements:
// логотип, телефон, иконка поиска, CTA «Запросить КП».
// Навигация на <a>: маршруты из sitemap.md, кроме «/», ещё не созданы.
// Меняем на next/link, когда страницы появятся.
export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label={`${site.brand}, на главную`}>
          <span className={styles.brandMark} aria-hidden="true" />
          <span>{site.brand}</span>
        </Link>

        <button
          type="button"
          className={styles.search}
          disabled
          aria-label="Поиск по сайту"
          title="Поиск — ожидает подключения"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" />
            <path d="M12.5 12.5 17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <a className={styles.phone} href={`tel:${site.phone.replace(/\s/g, "")}`}>
          {site.phone}
        </a>

        <a
          className={styles.headerCta}
          href={hero.primaryCta.href}
          data-analytics="hero_quote_click"
        >
          {hero.primaryCta.label}
        </a>
      </div>

      <nav className={styles.nav} aria-label="Основная навигация">
        {nav.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
