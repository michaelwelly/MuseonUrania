import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { DarkCta } from "@/components/Blocks";
import { fetchProducts } from "@/lib/api";
import { leadHref } from "@/lib/lead-link";
import { ui as strings } from "@/content/ui";
import Catalog from "./catalog";
import styles from "./page.module.css";

// Каталог. Тело страницы вынесено из `page.tsx` в `screen.tsx`, потому что
// `screen.tsx` маршрутом не является — Next знает только `page`, `layout`,
// `route` и ещё несколько имён. Здесь можно держать любые экспорты и рисовать
// экран из тестов, чего `page.tsx` не позволяет.
//
// Названия и описания изделий приходят из API: их правит заказчик. Всё
// содержательное на этой странице живёт внутри `Catalog`.

export function productsMetadata(): Metadata {
  return pageMetadata({
    title: strings.meta.products,
    description: strings.meta.productsLead,
    path: "/products/",
  });
}

export default async function ProductsScreen() {
  // Категории больше не запрашиваются: фильтр по ним убран, и полоса цифр
  // над каталогом — тоже. Считать «5 направлений» было не по чем и незачем:
  // изделий четыре, из пяти направлений два пустых, и полоса объявляла
  // ассортимент шире реального. Ту же полосу сняли с «О компании» по §2.1.
  const products = await fetchProducts();

  return (
    <main className={styles.page}>
      <PageHero
        crumbs={[{ label: strings.crumbs.home, href: "/" }, { label: strings.crumbs.products }]}
        title={strings.products.heroTitle}
        lead={strings.meta.productsLead}
      />

      <Catalog products={products} />

      <DarkCta
        tone="deep"
        title={strings.products.ctaTitle}
        text={strings.products.ctaText}
        // «Запросить подбор» — это и есть тема «Консультация по подбору»:
        // кнопка приводит в форму с ней, а не на общие контакты, где список
        // тем человек разбирает заново.
        primary={{
          label: strings.actions.requestSelection,
          href: leadHref("consultation"),
          analytics: "product_quote_click",
        }}
        // Якорь Ведалины — на текущей странице: виджет открывается прокруткой
        // и `hashchange`, а не переходом.
        secondary={{ label: strings.actions.askVedalina, href: "#vedalina" }}
      />
    </main>
  );
}
