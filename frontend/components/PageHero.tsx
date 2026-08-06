import Link from "next/link";
import styles from "./PageHero.module.css";

type Crumb = { label: string; href?: string };

type Props = {
  crumbs: Crumb[];
  title: string;
  lead?: string;
  /** Цифры справа по низу — экраны «Продукция» и «О компании». */
  stats?: { value: string; label: string }[];
  /** Произвольный блок справа — например кнопка на экране «Документы». */
  aside?: React.ReactNode;
};

export default function PageHero({ crumbs, title, lead, stats, aside }: Props) {
  return (
    <section className={styles.hero}>
      <div>
        <p className={styles.crumbs}>
          {crumbs.map((c, i) => (
            <span key={c.label}>
              {i > 0 && " / "}
              {c.href ? <Link href={c.href}>{c.label}</Link> : c.label}
            </span>
          ))}
        </p>
        <h1 className={styles.title}>{title}</h1>
        {lead && <p className={styles.lead}>{lead}</p>}
      </div>

      {(stats || aside) && (
        <div className={styles.aside}>
          {stats && (
            <ul className={styles.stats}>
              {stats.map((s) => (
                <li key={s.label}>
                  <p className={styles.statValue}>{s.value}</p>
                  <p className={styles.statLabel}>{s.label}</p>
                </li>
              ))}
            </ul>
          )}
          {aside}
        </div>
      )}
    </section>
  );
}
