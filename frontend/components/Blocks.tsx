import Link from "next/link";
import styles from "./Blocks.module.css";

/** Полоса из четырёх цифр. Экраны «Главная» и «О компании». */
export function StatsBand({ items }: { items: { value: string; label: string }[] }) {
  return (
    <ul className={`${styles.stats} crossField`} aria-label="Ключевые цифры">
      {items.map((s, i) => (
        <li key={s.label} className={styles.stat} data-reveal={i}>
          <p className={styles.statValue}>{s.value}</p>
          <p className={styles.statLabel}>{s.label}</p>
        </li>
      ))}
    </ul>
  );
}

type Action = { label: string; href: string; analytics?: string };

/** Тёмная полоса-призыв с двумя кнопками. Экраны 02, 04 и далее. */
export function DarkCta({
  title,
  text,
  primary,
  secondary,
  tone = "deep-2",
}: {
  title: string;
  text: string;
  primary: Action;
  secondary?: Action;
  tone?: "deep" | "deep-2";
}) {
  return (
    <section
      className={`${styles.cta} ${tone === "deep" ? styles.ctaDeep : styles.ctaDeep2} crossField crossFieldDark`}
    >
      <div data-reveal="0">
        <h2 className={styles.ctaTitle} data-words="30">
          {title}
        </h2>
        <p className={styles.ctaText}>{text}</p>
      </div>
      <div className={styles.ctaActions} data-reveal="1">
        <Link
          className={`${styles.btn} ${styles.btnPrimary}`}
          href={primary.href}
          data-analytics={primary.analytics}
        >
          {primary.label}
        </Link>
        {secondary && (
          <Link
            className={`${styles.btn} ${styles.btnGhost}`}
            href={secondary.href}
            data-analytics={secondary.analytics}
          >
            {secondary.label}
          </Link>
        )}
      </div>
    </section>
  );
}
