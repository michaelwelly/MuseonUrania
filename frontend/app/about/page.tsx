import type { Metadata } from "next";
import Image from "next/image";
import { hero, headerCta } from "@/content/site";
import {
  aboutHero,
  directions,
  production,
  products,
  quality,
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
      <section className={styles.section}>
        <div className={`${styles.narrow} ${styles.hero}`}>
          <div>
            <p className={styles.eyebrow}>{aboutHero.eyebrow}</p>
            <h1 className={styles.h1}>{aboutHero.headline}</h1>
            <p className={styles.lead}>{aboutHero.lead}</p>
          </div>
          <div className={styles.heroImage}>
            <Image
              src={aboutHero.image.src}
              alt={aboutHero.image.alt}
              fill
              sizes="(max-width: 1000px) 100vw, 50vw"
              priority
            />
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.soft}`}>
        <div className={styles.narrow}>
          <h2 className={styles.h2}>Направления</h2>
          <ul className={styles.grid}>
            {directions.map((d) => (
              <li key={d.title} className={styles.card}>
                <h3 className={styles.cardTitle}>{d.title}</h3>
                <p className={styles.cardText}>{d.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section}>
        <div className={`${styles.narrow} ${styles.split}`}>
          <div>
            <h2 className={styles.h2}>{production.title}</h2>
            {production.paragraphs.map((p) => (
              <p key={p} className={styles.paragraph}>
                {p}
              </p>
            ))}
          </div>
          <div className={styles.splitImage}>
            <Image
              src={production.image.src}
              alt={production.image.alt}
              fill
              sizes="(max-width: 1000px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.soft}`}>
        <div className={styles.narrow}>
          <h2 className={styles.h2}>Продукция</h2>
          <ul className={styles.grid}>
            {products.map((p) => (
              <li key={p.name} className={styles.card}>
                <h3 className={styles.cardTitle}>{p.name}</h3>
                <p className={styles.cardKind}>{p.kind}</p>
                <p className={styles.cardText}>{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.narrow}>
          <h2 className={styles.h2}>{quality.title}</h2>
          <p className={styles.paragraph}>{quality.text}</p>
          <p className={styles.note}>{quality.note}</p>
        </div>
      </section>

      <section className={`${styles.section} ${styles.soft}`}>
        <div className={styles.narrow}>
          <h2 className={styles.h2}>Партнёры</h2>
          <ul className={styles.grid}>
            {partners.map((p) => (
              <li key={p.name} className={styles.card}>
                <h3 className={styles.cardTitle}>{p.name}</h3>
                <p className={styles.cardText}>{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section}>
        <div className={`${styles.narrow} ${styles.split} ${styles.splitFirst}`}>
          <div>
            <h2 className={styles.h2}>{legal.title}</h2>
            <table className={styles.table}>
              <tbody>
                {legal.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.splitImage}>
            <Image
              src={legal.image.src}
              alt={legal.image.alt}
              fill
              sizes="(max-width: 1000px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.soft}`}>
        <div className={`${styles.narrow} ${styles.cta}`}>
          <div>
            <h2 className={styles.h2}>{aboutCta.title}</h2>
            <p className={styles.lead}>{aboutCta.text}</p>
          </div>
          <div className={styles.actions}>
            <a
              className={`${styles.button} ${styles.primary}`}
              href={hero.primaryCta.href}
              data-analytics="hero_quote_click"
            >
              {hero.primaryCta.label}
            </a>
            <a
              className={`${styles.button} ${styles.secondary}`}
              href={headerCta.href}
              data-analytics="header_contact_click"
            >
              {headerCta.label}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
