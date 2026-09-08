import type { Metadata } from "next";
import ProductScreen, { productMetadata } from "./screen";
import { fetchProducts } from "@/lib/api";
import { DEFAULT_LANG } from "@/lib/i18n";

// Русская карточка изделия. Тело — в `screen.tsx`: его же рисуют
// `/en/products/[slug]/` и `/zh/products/[slug]/`.

export async function generateStaticParams() {
  const products = await fetchProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return productMetadata(slug, DEFAULT_LANG);
}

export default async function ProductPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  return <ProductScreen slug={slug} lang={DEFAULT_LANG} />;
}
