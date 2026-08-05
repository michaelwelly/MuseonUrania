import type { Metadata } from "next";
import Image from "next/image";
import { hero, headerCta } from "@/content/site";
import {
  techHero,
  development,
  technologies,
  techNotice,
} from "@/content/technology";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Разработка и технологии — VEDAL",
  description: techHero.lead,
};

export default function TechnologyPage() {
  return (
    <main className={styles.page}>
      <section className={styles.section}>
        <div className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>{techHero.eyebrow}</p>
            <h1 className={styles.h1}>{techHero.headline}</h1>
            <p className={styles.lead}>{techHero.lead}</p>
          </div>
          <div className={styles.heroImage}>
            <Image
              src={techHero.image.src}
              alt={techHero.image.alt}
              fill
              sizes="(max-width: 1000px) 100vw, 50vw"
              priority
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.split}>
          <div>
            <h2 className={styles.h2}>{development.title}</h2>
            {development.paragraphs.map((p) => (
              <p key={p} className={styles.paragraph}>
                {p}
              </p>
            ))}
          </div>
          <div className={styles.splitImage}>
            <Image
              src={development.image.src}
              alt={development.image.alt}
              fill
              sizes="(max-width: 1000px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Технические решения в изделиях</h2>
        <p className={styles.lead}>
          Значения приведены по документации производителя. Рядом с каждым блоком
          указано изделие, к которому они относятся.
        </p>
        <ul className={styles.grid}>
          {technologies.map((t) => (
            <li key={t.title} className={styles.card}>
              <h3 className={styles.cardTitle}>{t.title}</h3>
              <p className={styles.source}>{t.source}</p>
              <ul className={styles.specs}>
                {t.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{techNotice.title}</h2>
        <ul className={styles.pending}>
          {techNotice.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className={styles.note}>{techNotice.note}</p>
      </section>

      <section className={styles.section}>
        <div className={styles.assistant}>
          <div>
            <h2 className={styles.h2}>Нужны характеристики под конкретную задачу?</h2>
            <p className={styles.lead}>
              Специалист подберёт конфигурацию и пришлёт документацию по изделию.
            </p>
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
