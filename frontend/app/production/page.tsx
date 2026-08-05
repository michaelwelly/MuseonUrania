import type { Metadata } from "next";
import Image from "next/image";
import { hero, headerCta } from "@/content/site";
import {
  productionHero,
  facility,
  gallery,
  quality,
} from "@/content/production";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Производство — VEDAL",
  description: productionHero.lead,
};

export default function ProductionPage() {
  return (
    <main className={styles.page}>
      <section className={styles.section}>
        <div className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>{productionHero.eyebrow}</p>
            <h1 className={styles.h1}>{productionHero.headline}</h1>
            <p className={styles.lead}>{productionHero.lead}</p>
          </div>
          <div className={styles.heroImage}>
            <Image
              src={productionHero.image.src}
              alt={productionHero.image.alt}
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
            <h2 className={styles.h2}>{facility.title}</h2>
            {facility.paragraphs.map((p) => (
              <p key={p} className={styles.paragraph}>
                {p}
              </p>
            ))}
          </div>
          <div className={styles.splitImage}>
            <Image
              src={facility.image.src}
              alt={facility.image.alt}
              fill
              sizes="(max-width: 1000px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Участок в снимках</h2>
        <ul className={styles.gallery}>
          {gallery.map((shot) => (
            <li key={shot.src} className={styles.shot}>
              <Image
                src={shot.src}
                alt={shot.alt}
                fill
                sizes="(max-width: 560px) 100vw, (max-width: 1000px) 50vw, 25vw"
              />
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{quality.title}</h2>
        <ul className={styles.pending}>
          {quality.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className={styles.note}>{quality.note}</p>
      </section>

      <section className={styles.section}>
        <div className={styles.assistant}>
          <div>
            <h2 className={styles.h2}>Нужны детали по производству или поставке?</h2>
            <p className={styles.lead}>
              Специалист ответит на вопросы по комплектации, срокам и документации.
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
