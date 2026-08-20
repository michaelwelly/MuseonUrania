import Link from "next/link";
import LivePattern from "./LivePattern";
import styles from "./Blocks.module.css";

// Компонент StatsBand удалён 19 августа. Полоса из четырёх цифр стояла на
// «Главной» и «О компании»; со второй её снял §2.1, с первой — прямое решение
// заказчика. Полос на сайте не осталось ни одной.
//
// Компонент не оставлен «на всякий случай» намеренно: заказчик отказался от
// этого блока дважды, и готовый к вставке StatsBand — это приглашение вернуть
// его третий раз. Понадобится — есть в истории.

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
      className={`${styles.cta} ${tone === "deep" ? styles.ctaDeep : styles.ctaDeep2} patternHost`}
    >
      {/* На тёмной полосе паттерн идёт без квадратов и сильно приглушённым:
          насыщенный зелёный квадрат на почти чёрном превращается в световое
          пятно и тянет взгляд сильнее, чем заголовок рядом. */}
      <LivePattern variant={2} tone="dark" />
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
