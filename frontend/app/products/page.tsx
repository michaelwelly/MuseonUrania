import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { DarkCta } from "@/components/Blocks";
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

      <DarkCta
        tone="deep"
        title="Не нашли нужную конфигурацию?"
        text="Опишите задачу отделения — Урания подскажет модели сразу, а специалист подготовит предложение с характеристиками и документами."
        primary={{
          label: "Запросить подбор",
          href: "/contacts/",
          analytics: "product_quote_click",
        }}
        secondary={{ label: "Спросить Уранию", href: "#urania" }}
      />
    </main>
  );
}
