import type { Metadata } from "next";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import { StatsBand, DarkCta } from "@/components/Blocks";
import {
  aboutHero,
  aboutStats,
  cycle,
  directions,
  partners,
  legal,
  aboutCta,
} from "@/content/about";
import styles from "./page.module.css";

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
          src={aboutHero.image.src}
          alt={aboutHero.image.alt}
          fill
          sizes="100vw"
          priority
        />
      </div>

      <StatsBand items={aboutStats} />

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
      </section>

      <section className={styles.directions}>
        <h2 className={styles.h2} data-words="34">
          Направления
        </h2>
        <ul className={styles.grid5}>
          {directions.map((d, i) => (
            <li key={d.n} className={styles.dirCell} data-reveal={i}>
              <p className={styles.num}>{d.n}</p>
              <h3 className={styles.cellTitle}>{d.title}</h3>
              <p className={styles.cellText}>{d.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.partners}>
        <div className={styles.partnersCopy} data-reveal="0">
          <p className={`${styles.eyebrow} ${styles.eyebrowDark}`}>{partners.eyebrow}</p>
          <h2 className={styles.partnersTitle} data-words="30">
            {partners.title}
          </h2>
          <ul className={styles.partnerList}>
            {partners.items.map((p) => (
              <li key={p.name} className={styles.partner}>
                <p className={styles.partnerName}>{p.name}</p>
                <p className={styles.partnerText}>{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.photo} data-reveal="1">
          <Image
            src={partners.image.src}
            alt={partners.image.alt}
            fill
            sizes="(max-width: 1100px) 100vw, 50vw"
          />
        </div>
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
            src={legal.image.src}
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
