import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import VedalMap from "@/components/VedalMap";
import { site } from "@/content/site";
import { productionHero, facility, gallery, quality, address } from "@/content/production";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Производство — VEDAL",
  description: productionHero.lead,
};

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export default function ProductionPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.crumbs}>
            <Link href="/">Главная</Link> / Производство
          </p>
          <h1 className={styles.h1} data-words="34" data-wdelay="110">
            {productionHero.title}
          </h1>
          <p className={styles.lead} data-words="13" data-wdelay="400">
            {productionHero.lead}
          </p>
          <div className={styles.heroActions} data-anim="cascade">
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/contacts/">
              Записаться на визит
            </Link>
            <a className={`${styles.btn} ${styles.btnGhost}`} href="#map">
              Схема проезда
            </a>
          </div>
        </div>
        <div className={styles.photo} data-anim="clip ken">
          <Image
            src={productionHero.image.src}
            alt={productionHero.image.alt}
            fill
            sizes="(max-width: 1100px) 100vw, 50vw"
            priority
          />
        </div>
      </section>

      <section className={styles.facility}>
        <div data-reveal="0">
          <p className={styles.eyebrow}>{facility.eyebrow}</p>
          <h2 className={styles.h2} data-words="30">
            {facility.title}
          </h2>
        </div>
        <div data-reveal="1">
          {facility.paragraphs.map((p) => (
            <p key={p} className={styles.paragraph}>
              {p}
            </p>
          ))}
          <ul className={styles.facts}>
            {facility.facts.map((f) => (
              <li key={f.label} className={styles.fact}>
                <span>{f.label}</span>
                <span className={styles.factValue}>{f.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ul className={styles.gallery}>
        {gallery.map((shot, i) => (
          <li key={shot.src} data-reveal={i}>
            <div className={styles.shot}>
              <Image
                src={shot.src}
                alt={shot.alt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
              />
            </div>
          </li>
        ))}
      </ul>

      <section className={styles.quality}>
        <div data-reveal="0">
          <p className={styles.eyebrow}>{quality.eyebrow}</p>
          <h2 className={styles.qualityTitle} data-words="30">
            {quality.title}
          </h2>
          <p className={styles.qualityText}>{quality.text}</p>
          <Link className={`${styles.btn} ${styles.btnDark} ${styles.qualityCta}`} href="/documents/">
            Раздел «Документы»
            <Arrow />
          </Link>
        </div>
        <ul className={styles.qualityList} data-reveal="1">
          {quality.items.map((item) => (
            <li key={item.n} className={styles.qualityRow}>
              <span className={styles.num}>{item.n}</span>
              <span className={styles.qualityRowText}>{item.text}</span>
              <span
                className={`${styles.badge} ${
                  item.access === "Уточняется" ? styles.badgeMuted : styles.badgeOk
                }`}
              >
                {item.access}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.address} id="map">
        <div className={styles.addressCopy} data-reveal="0">
          <p className={styles.eyebrow}>{address.eyebrow}</p>
          <h2 className={styles.addressTitle} data-words="30">
            {address.title}
          </h2>
          <address className={styles.addressLines}>
            {address.lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
            <span>
              Пн–Пт 9:00–18:00 ·{" "}
              <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>
            </span>
          </address>
          <Link
            className={`${styles.btn} ${styles.btnOutline} ${styles.addressCta}`}
            href="/contacts/"
          >
            Построить маршрут
          </Link>
        </div>
        <div className={styles.mapSlot} data-reveal="1">
          <VedalMap />
        </div>
      </section>
    </main>
  );
}
