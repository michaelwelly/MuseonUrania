import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import VedalMap from "@/components/VedalMap";
import { site } from "@/content/site";
import { productionHero, facility, gallery, address } from "@/content/production";
import TreeMark from "@/components/TreeMark";
import styles from "./page.module.css";
import { mediaSrc } from "@/lib/media";

export const metadata: Metadata = {
  title: "Производство — VEDAL",
  description: productionHero.lead,
};

export default function ProductionPage() {
  return (
    <main className={styles.page}>
      {/* Паттерна нет по той же причине, что на главной: правая половина
          полосы занята фото во всю высоту. */}
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
          {/* «Записаться на визит» убрано по §6.1 плана: приём посетителей
              никто не подтверждал, а кнопка его обещала. */}
          <div className={styles.heroActions} data-anim="cascade">
            <a className={`${styles.btn} ${styles.btnGhost}`} href="#map">
              Схема проезда
            </a>
          </div>
        </div>
        <div className={styles.photo} data-anim="clip ken">
          <Image
            src={mediaSrc(productionHero.image.src)}
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
          {/* §11.2: место маркировочного знака. Рисуется, когда заказчик
              передаст файл — см. content/brand.ts. */}
          <TreeMark where="production" />
        </div>
      </section>

      <ul className={styles.gallery}>
        {gallery.map((shot, i) => (
          <li key={shot.src} data-reveal={i}>
            <div className={styles.shot}>
              <Image
                src={mediaSrc(shot.src)}
                alt={shot.alt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
              />
            </div>
          </li>
        ))}
      </ul>

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
