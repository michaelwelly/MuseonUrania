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

/** Тёмная полоса-призыв с двумя кнопками. Экраны 02, 04 и далее. */
export function DarkCta({
  title,
  text,
  primary,
  secondary,
  textLang,
  tone = "deep-2",
}: {
  title: string;
  text: string;
  primary: Action;
  secondary?: Action;
  /**
   * Язык заголовка и текста полосы, если он не совпадает с языком страницы.
   *
   * Полоса-призыв несёт содержательный текст, и на переведённых версиях он
   * показывается русским оригиналом, пока перевод не согласован. Подписи
   * кнопок сюда не входят: они интерфейс и переведены всегда.
   */
  textLang?: "ru";
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
      <div data-reveal="0" lang={textLang}>
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
