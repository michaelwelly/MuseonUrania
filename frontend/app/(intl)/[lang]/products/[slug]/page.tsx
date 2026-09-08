import type { Metadata } from "next";
import ProductScreen, { productMetadata } from "@/app/(site)/products/[slug]/screen";
import { fetchProducts } from "@/lib/api";
import { intlLang } from "@/lib/intl-route";

// Карточка изделия на английском и китайском:
// `/en/products/[slug]/`, `/zh/products/[slug]/`.

/**
 * Только слаги — языки перечисляет layout.
 *
 * `app/(intl)/[lang]/layout.tsx` уже возвращает список языков для своего
 * сегмента, и Next перемножает его с тем, что вернём мы. Вернуть здесь
 * пары `{ lang, slug }` значило бы перечислить языки дважды и получить
 * либо дубли, либо расхождение с layout при добавлении четвёртого языка.
 */
export async function generateStaticParams() {
  const products = await fetchProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(
  props: PageProps<"/[lang]/products/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  return productMetadata(slug, await intlLang(props.params));
}

export default async function LocalizedProduct(props: PageProps<"/[lang]/products/[slug]">) {
  const { slug } = await props.params;
  return <ProductScreen slug={slug} lang={await intlLang(props.params)} />;
}
