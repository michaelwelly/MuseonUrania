import type { Metadata } from "next";
import ProductScreen, { productMetadata } from "./screen";
import { fetchProducts } from "@/lib/api";

// Карточка изделия. Тело — в `screen.tsx`; здесь остаётся разбор `params`:
// адрес читает маршрут, а экран получает уже разобранный slug.

export async function generateStaticParams() {
  const products = await fetchProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return productMetadata(slug);
}

export default async function ProductPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  return <ProductScreen slug={slug} />;
}
