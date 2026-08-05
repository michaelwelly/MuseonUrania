import Image from "next/image";
import UraniaCard from "@/components/UraniaCard";
import UraniaFloatingButton from "@/components/UraniaFloatingButton";
import { AWAITING, hero } from "@/content/site";
import styles from "./page.module.css";

// Первый экран главной — prototypes/urania-web-interface.html,
// приведённый к docs/frontend (sitemap.md, page_briefs.md, content_model.md).
// Остальные секции главной из sitemap.md → Home Page Structure ещё не сделаны.
const URANIA_SLOT_ID = "urania";

export default function Home() {
  return (
    <>
      <main className={styles.hero}>
        <section className={styles.copy}>
          <h1 className={styles.headline}>{hero.headline}</h1>
          <p className={styles.lead}>{hero.lead}</p>

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
              href={hero.secondaryCta.href}
              data-analytics="hero_catalog_click"
            >
              {hero.secondaryCta.label}
            </a>
          </div>

          <ul className={styles.proofs}>
            {hero.proofs.map((proof) => (
              <li key={proof} className={styles.proof}>
                {proof}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.visual} aria-label="Визуальный блок и ассистент">
          {hero.image ? (
            <div className={styles.heroImage}>
              <Image
                src={hero.image.src}
                alt={hero.image.alt}
                fill
                sizes="(max-width: 1100px) 100vw, 55vw"
                priority
              />
            </div>
          ) : (
            <p className={styles.imageSlot}>
              Фото производства или продукции VEDAL
              <span className={styles.awaiting}>{AWAITING}</span>
            </p>
          )}

          <div className={styles.assistantSlot} id={URANIA_SLOT_ID}>
            <UraniaCard />
          </div>
        </section>
      </main>

      <UraniaFloatingButton targetId={URANIA_SLOT_ID} />
    </>
  );
}
