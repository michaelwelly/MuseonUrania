import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { DarkCta } from "@/components/Blocks";
import { fetchProducts } from "@/lib/api";
import Catalog from "./catalog";
import styles from "./page.module.css";

const lead =
  "Изделия для неонатологии, реанимации, анестезиологии, мониторинга и интенсивной терапии. У каждой позиции указан статус документации.";

export const metadata: Metadata = {
  title: "Каталог оборудования — VEDAL",
  description: lead,
};

export default async function ProductsPage() {
  // Категории больше не запрашиваются: фильтр по ним убран, и полоса цифр
  // над каталогом — тоже. Считать «5 направлений» было не по чем и незачем:
  // изделий четыре, из пяти направлений два пустых, и полоса объявляла
  // ассортимент шире реального. Ту же полосу сняли с «О компании» по §2.1.
  const products = await fetchProducts();

  return (
    <main className={styles.page}>
      <PageHero
        crumbs={[{ label: "Главная", href: "/" }, { label: "Продукция" }]}
        title="Каталог оборудования"
        lead={lead}
      />

      <Catalog products={products} />

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
