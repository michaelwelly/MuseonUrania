import Link from "next/link";
import LivePattern from "./LivePattern";
import styles from "./PageHero.module.css";

type Crumb = { label: string; href?: string };

// Проп stats убран: полосы цифр не осталось ни на одном экране. «О компании»
// потеряла её по §2.1, «Продукция» — 19 августа вместе с фильтром. Держать
// неиспользуемый проп значит предлагать следующему разработчику вернуть
// именно то, что заказчик дважды попросил убрать.
type Props = {
  crumbs: Crumb[];
  title: string;
  lead?: string;
  /**
   * Язык заголовка и лида, если он не совпадает с языком страницы.
   *
   * Заголовок раздела — содержательный текст, и на переведённых версиях он
   * показывается русским оригиналом, пока перевод не согласован. Помечать его
   * обязан тот, кто знает про откат, — экран: `c.mark(hero.title, hero.lead)`.
   * Без пометки браузер, скринридер и встроенный переводчик считают русский
   * заголовок английским.
   *
   * Крошки этой пометкой не задеты: они интерфейс и переведены всегда.
   */
  textLang?: "ru";
  /** Произвольный блок справа — например кнопка на экране «Документы». */
  aside?: React.ReactNode;
};

export default function PageHero({ crumbs, title, lead, textLang, aside }: Props) {
  return (
    <section className={`${styles.hero} patternHost`}>
      <LivePattern />
      <div>
        <p className={styles.crumbs}>
          {crumbs.map((c, i) => (
            <span key={c.label}>
              {i > 0 && " / "}
              {c.href ? <Link href={c.href}>{c.label}</Link> : c.label}
            </span>
          ))}
        </p>
        {/* Первый экран проявляется по словам, а не блоком: data-words —
            шаг между словами, data-wdelay — старт. */}
        <h1 className={styles.title} data-words="34" data-wdelay="110" lang={textLang}>
          {title}
        </h1>
        {lead && (
          <p className={styles.lead} data-words="13" data-wdelay="400" lang={textLang}>
            {lead}
          </p>
        )}
      </div>

      {aside && <div className={styles.aside}>{aside}</div>}
    </section>
  );
}
