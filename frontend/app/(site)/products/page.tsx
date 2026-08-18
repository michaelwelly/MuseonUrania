import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { DarkCta } from "@/components/Blocks";
import { fetchCategories, fetchProducts } from "@/lib/api";
import { directions, models } from "@/lib/plural";
import Catalog from "./catalog";
import styles from "./page.module.css";

const lead =
  "Изделия для неонатологии, реанимации, анестезиологии, мониторинга и интенсивной терапии. У каждой позиции указан статус документации.";

export const metadata: Metadata = {
  title: "Каталог оборудования — VEDAL",
  description: lead,
};

export default async function ProductsPage() {
  // Каталог и категории — с бэкенда на сборке. Запросы независимы, поэтому
  // идут параллельно: последовательные ждали бы друг друга без причины.
  const [products, categories] = await Promise.all([fetchProducts(), fetchCategories()]);

  return (
    <main className={styles.page}>
      <PageHero
        crumbs={[{ label: "Главная", href: "/" }, { label: "Продукция" }]}
        title="Каталог оборудования"
        lead={lead}
        stats={[
          { value: String(products.length), label: models(products.length) },
          { value: String(categories.length), label: directions(categories.length) },
        ]}
      />

      <Catalog products={products} categories={categories} />

      <DarkCta
        tone="deep"
        title="Не нашли нужную конфигурацию?"
        text="Опишите задачу отделения — Ведалина подскажет модели сразу, а специалист подготовит предложение с характеристиками и документами."
        primary={{
          label: "Запросить подбор",
          href: "/contacts/",
          analytics: "product_quote_click",
        }}
        secondary={{ label: "Спросить Ведалину", href: "#vedalina" }}
      />
    </main>
  );
}
