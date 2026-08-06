import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { categories, products } from "@/content/products";
import Catalog from "./catalog";
import styles from "./page.module.css";

const lead =
  "Изделия для неонатологии, реанимации, анестезиологии, мониторинга и интенсивной терапии. У каждой позиции указан статус документации.";

export const metadata: Metadata = {
  title: "Каталог оборудования — VEDAL",
  description: lead,
};

export default function ProductsPage() {
  return (
    <main className={styles.page}>
      <PageHero
        crumbs={[{ label: "Главная", href: "/" }, { label: "Продукция" }]}
        title="Каталог оборудования"
        lead={lead}
        stats={[
          { value: String(products.length), label: "моделей" },
          { value: String(categories.length), label: "направлений" },
        ]}
      />

      <Catalog />

      <section className={styles.cta}>
        <div>
          <h2 className={styles.ctaTitle}>Не нашли нужную конфигурацию?</h2>
          <p className={styles.ctaText}>
            Опишите задачу отделения — Урания подскажет модели сразу, а специалист подготовит
            предложение с характеристиками и документами.
          </p>
        </div>
        <div className={styles.ctaActions}>
          <Link
            className={`${styles.btn} ${styles.btnPrimary}`}
            href="/contacts/"
            data-analytics="product_quote_click"
          >
            Запросить подбор
          </Link>
          <Link className={`${styles.btn} ${styles.btnGhost}`} href="/#urania">
            Спросить Уранию
          </Link>
        </div>
      </section>
    </main>
  );
}
