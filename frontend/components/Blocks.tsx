import Link from "next/link";
import BrandPattern from "./BrandPattern";
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

/**
 * Кнопка полосы: якорь внутри страницы рисуется обычным `<a>`, переход
 * на другой адрес — через `Link`.
 *
 * Разница не косметическая. `Link` перехватывает клик и меняет адрес своим
 * `history.pushState`, а браузер шлёт `hashchange` только на настоящей
 * навигации по хешу. Виджет Ведалины открывается именно по `hashchange`
 * (`components/VedalinaWidget.tsx`), и «Спросить Ведалину» через `Link`
 * дописывала `#vedalina` в адрес, не открывая окна вовсе — issue #101.
 *
 * Клиентский переход якорю и не нужен: страница не меняется, а `<a>` вдобавок
 * работает без JS. Те же якоря в других местах — `#quote` на карточке изделия,
 * `#map` на «Производстве» — обычными `<a>` и нарисованы.
 */
function CtaLink({
  action,
  className,
}: {
  action: Action;
  className: string;
}) {
  if (action.href.startsWith("#")) {
    return (
      <a className={className} href={action.href} data-analytics={action.analytics}>
        {action.label}
      </a>
    );
  }
  return (
    <Link className={className} href={action.href} data-analytics={action.analytics}>
      {action.label}
    </Link>
  );
}

/**
 * Тёмная полоса-призыв с двумя кнопками. Экраны 02, 04 и далее.
 *
 * Узор на ней в другой краске: светлые формы уходят в белый на 7 и 13
 * процентов, акцент, наоборот, светлеет — фирменный зелёный на почти чёрном
 * сливается с фоном. Так же он покрашен на тёмной полосе главной.
 *
 * Зоны сняты замером на ширине 1440. В системе координат поля (1400 × 210)
 * заголовок и текст занимают левую половину до 730, кнопки стоят справа
 * от 1067. Обе зоны нестрогие: бледные формы на 7% белого читаются фактурой
 * подложки и текст не трогают, а запрет на них оставил бы полосу пустой —
 * свободного места на ней всего триста пикселей в середине.
 */
export function DarkCta({
  title,
  text,
  primary,
  secondary,
  tone = "deep-2",
  pattern,
}: {
  title: string;
  text: string;
  primary: Action;
  secondary?: Action;
  tone?: "deep" | "deep-2";
  /** Зерно узора; `null` — полоса без узора. Обязателен: см. PageHero. */
  pattern: number | null;
}) {
  return (
    <section
      className={`${styles.cta} ${tone === "deep" ? styles.ctaDeep : styles.ctaDeep2} patternHost`}
    >
      {/* На тёмной полосе паттерн идёт без квадратов и сильно приглушённым:
          насыщенный зелёный квадрат на почти чёрном превращается в световое
          пятно и тянет взгляд сильнее, чем заголовок рядом. */}
      <LivePattern variant={2} tone="dark" />
      {pattern !== null && (
        <div className={styles.ctaPattern}>
          <BrandPattern
            seed={pattern}
            boldness={3}
            width={1400}
            height={210}
            tone="dark"
            keepClear={[
              // Заголовок и абзац под ним.
              { x2: 760, y1: 45, y2: 165 },
              // Кнопки.
              { x1: 1050, x2: 1400, y1: 65, y2: 145 },
            ]}
          />
        </div>
      )}
      <div data-reveal="0">
        <h2 className={styles.ctaTitle} data-words="30">
          {title}
        </h2>
        <p className={styles.ctaText}>{text}</p>
      </div>
      <div className={styles.ctaActions} data-reveal="1">
        <CtaLink action={primary} className={`${styles.btn} ${styles.btnPrimary}`} />
        {secondary && (
          <CtaLink action={secondary} className={`${styles.btn} ${styles.btnGhost}`} />
        )}
      </div>
    </section>
  );
}
