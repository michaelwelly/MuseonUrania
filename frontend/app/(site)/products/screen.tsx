import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import TranslationNotice from "@/components/TranslationNotice";
import { DarkCta } from "@/components/Blocks";
import { fetchProducts } from "@/lib/api";
import { ui } from "@/content/ui";
import { localePath, type Lang } from "@/lib/i18n";
import Catalog from "./catalog";
import styles from "./page.module.css";

// Каталог. Тело страницы вынесено из `page.tsx` в `screen.tsx`, потому что
// его рисуют два маршрута: `/products/` (русский, `app/(site)`) и
// `/[lang]/products/` (переведённый, `app/(intl)`). Файл `screen.tsx`
// маршрутом не является — Next знает только `page`, `layout`, `route` и ещё
// несколько имён, — поэтому здесь можно держать любые экспорты.
//
// Названия и описания изделий приходят из API и не переводятся нами: их
// правит заказчик. Всё содержательное на этой странице живёт внутри
// `Catalog`, там же и откат на русский.

export function productsMetadata(lang: Lang): Metadata {
  const strings = ui(lang);
  return pageMetadata({
    title: strings.meta.products,
    description: strings.meta.productsLead,
    path: "/products/",
    lang,
  });
}

export default async function ProductsScreen({ lang }: { lang: Lang }) {
  // Категории больше не запрашиваются: фильтр по ним убран, и полоса цифр
  // над каталогом — тоже. Считать «5 направлений» было не по чем и незачем:
  // изделий четыре, из пяти направлений два пустых, и полоса объявляла
  // ассортимент шире реального. Ту же полосу сняли с «О компании» по §2.1.
  const products = await fetchProducts();
  const strings = ui(lang);
  const at = (path: string) => localePath(lang, path);

  return (
    <main className={styles.page}>
      <PageHero
        crumbs={[{ label: strings.crumbs.home, href: at("/") }, { label: strings.crumbs.products }]}
        title={strings.products.heroTitle}
        lead={strings.meta.productsLead}
      />

      {/* Примечание о непереведённом стоит сразу после первого экрана:
          ниже начинаются названия, направления и описания изделий, перевод
          которых согласовывает заказчик. Для русской версии не рисуется. */}
      <TranslationNotice lang={lang} />

      <Catalog products={products} lang={lang} />

      <DarkCta
        tone="deep"
        title={strings.products.ctaTitle}
        text={strings.products.ctaText}
        primary={{
          label: strings.actions.requestSelection,
          href: at("/contacts/"),
          analytics: "product_quote_click",
        }}
        // Якорь Ведалины — на текущей странице, префикс языка ему не нужен
        // и был бы вреден: `/en/products/#vedalina` перезагрузил бы страницу
        // вместо прокрутки к виджету.
        secondary={{ label: strings.actions.askVedalina, href: "#vedalina" }}
      />
    </main>
  );
}
