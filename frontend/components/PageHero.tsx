import Link from "next/link";
import BrandPattern from "./BrandPattern";
import LivePattern from "./LivePattern";
import { JsonLd, breadcrumbStructuredData } from "@/lib/structured-data";
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
  currentPath?: string;
  /** Произвольный блок справа — например кнопка на экране «Документы». */
  aside?: React.ReactNode;
  /**
   * Зерно фирменного узора — или `null`, если узора на этой полосе нет.
   *
   * Проп обязательный, и это единственная его защита. Необязательный
   * страница просто не передала бы, и полоса вышла бы без узора молча —
   * а «узора нет» и «про узор забыли» на экране выглядят одинаково.
   * Так решение принимает каждая страница, и видно, что оно принято.
   *
   * Зерно у каждой полосы своё: одно и то же дало бы на всех внутренних
   * страницах один и тот же рисунок, и переход между разделами читался бы
   * как перезагрузка той же картинки.
   */
  pattern: number | null;
};

/**
 * Шапка внутренней страницы: крошки, заголовок, лид и узор фоном.
 *
 * Зоны узора сняты замером в браузере на ширине 1440, а не назначены
 * на глаз. В системе координат поля (1400 × 330) текст полосы кончается
 * на 922 по горизонтали и на 287 по вертикали — это самая длинная из пяти
 * шапок, «О компании»; на остальных он короче и уже.
 *
 * Зона нестрогая: она держит вне себя акценты, но пускает бледные формы.
 * Насыщенный квадрат за строкой перетягивает взгляд с первого слова,
 * а бледная форма светлее бумаги под буквами и читать не мешает, — без
 * неё же левые две трети полосы пустуют, и композиция валится вправо.
 */
export default function PageHero({ crumbs, title, lead, currentPath, aside, pattern }: Props) {
  return (
    <section className={`${styles.hero} patternHost`}>
      {currentPath && (
        <JsonLd
          id={`breadcrumb-jsonld-${currentPath.replace(/[^a-z0-9]+/gi, "-") || "home"}`}
          data={breadcrumbStructuredData(crumbs, currentPath)}
        />
      )}
      <LivePattern />
      {pattern !== null && (
        <div className={styles.pattern}>
          <BrandPattern
            seed={pattern}
            boldness={3}
            width={1400}
            height={330}
            keepClear={[
              // Крошки, заголовок и лид.
              { x2: 950, y1: 45, y2: 300 },
              // Кнопка справа — она есть только на «Документах», и зона
              // заводится вместе с ней: на полосе без кнопки этот угол
              // как раз и держит композицию.
              ...(aside ? [{ x1: 1110, x2: 1400, y1: 165, y2: 260 }] : []),
            ]}
          />
        </div>
      )}
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
        <h1 className={styles.title} data-words="34" data-wdelay="110">
          {title}
        </h1>
        {lead && (
          <p className={styles.lead} data-words="13" data-wdelay="400">
            {lead}
          </p>
        )}
      </div>

      {aside && <div className={styles.aside}>{aside}</div>}
    </section>
  );
}
