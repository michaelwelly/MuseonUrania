import type { Metadata } from "next";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import TreeMark from "@/components/TreeMark";
import { DarkCta } from "@/components/Blocks";
import {
  aboutHero,
  cycle,
  membership,
  legal,
  aboutCta,
} from "@/content/about";
import styles from "./page.module.css";
import { mediaSrc } from "@/lib/media";

export const metadata: Metadata = {
  title: "О компании — VEDAL",
  description: aboutHero.lead,
};

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <PageHero
        crumbs={[{ label: "Главная", href: "/" }, { label: "О компании" }]}
        title={aboutHero.title}
        lead={aboutHero.lead}
      />

      <div className={styles.banner} data-reveal="0">
        <Image
          src={mediaSrc(aboutHero.image.src)}
          alt={aboutHero.image.alt}
          fill
          sizes="100vw"
          priority
        />
      </div>

      <section className={styles.cycle}>
        <div data-reveal="0">
          <p className={styles.eyebrow}>{cycle.eyebrow}</p>
          <h2 className={styles.cycleTitle} data-words="30">
            {cycle.title}
          </h2>
        </div>
        <div data-reveal="1">
          {cycle.paragraphs.map((p) => (
            <p key={p} className={styles.paragraph}>
              {p}
            </p>
          ))}
          <ul className={styles.grid2}>
            {cycle.items.map((it) => (
              <li key={it.n} className={styles.cell}>
                <p className={styles.num}>{it.n}</p>
                <h3 className={styles.cellTitle}>{it.title}</h3>
                <p className={styles.cellText}>{it.text}</p>
              </li>
            ))}
          </ul>
        </div>
        {/* §11.2: место маркировочного знака. Рисуется, когда заказчик
            передаст файл — см. content/brand.ts. */}
        <TreeMark where="about" />
      </section>

      {/* Членство в УТПП, а не коммерческое партнёрство: блок намеренно
          отдельный и без интеграторов — §2.6 плана. Знак ведёт на сайт
          палаты, как просил заказчик. */}
      <section className={styles.membership}>
        <div className={styles.membershipCopy} data-reveal="0">
          <p className={styles.eyebrow}>{membership.eyebrow}</p>
          <h2 className={styles.membershipTitle} data-words="30">
            {membership.title}
          </h2>
          <p className={styles.membershipText}>{membership.text}</p>
          <a
            className={styles.membershipLink}
            href={membership.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {membership.linkLabel}
          </a>
        </div>
        <a
          className={styles.membershipMark}
          href={membership.href}
          target="_blank"
          rel="noopener noreferrer"
          data-reveal="1"
        >
          <Image
            src={membership.mark.src}
            alt={membership.mark.alt}
            width={membership.mark.width}
            height={membership.mark.height}
          />
        </a>
      </section>

      <section className={styles.legal}>
        <div data-reveal="0">
          <h2 className={styles.legalTitle} data-words="30">
            {legal.title}
          </h2>
          <div className={styles.table}>
            {legal.rows.map((row) => (
              <div key={row.label} className={styles.row}>
                <span className={styles.rowLabel}>{row.label}</span>
                <span>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.legalPhoto} data-reveal="1">
          <Image
            src={mediaSrc(legal.image.src)}
            alt={legal.image.alt}
            fill
            sizes="(max-width: 1100px) 100vw, 45vw"
          />
        </div>
      </section>

      <DarkCta
        title={aboutCta.title}
        text={aboutCta.text}
        primary={{ label: "Запросить КП", href: "/contacts/", analytics: "hero_quote_click" }}
        secondary={{ label: "Контакты", href: "/contacts/" }}
      />
    </main>
  );
}
