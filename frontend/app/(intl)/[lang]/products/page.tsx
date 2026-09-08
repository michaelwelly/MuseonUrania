import type { Metadata } from "next";
import ProductsScreen, { productsMetadata } from "@/app/(site)/products/screen";
import { intlLang } from "@/lib/intl-route";

// Каталог на английском и китайском: `/en/products/`, `/zh/products/`.
//
// Тело страницы одно на все языки — `app/(site)/products/screen.tsx`.
// Здесь только разбор языка из адреса.

export async function generateMetadata(
  props: PageProps<"/[lang]/products">,
): Promise<Metadata> {
  return productsMetadata(await intlLang(props.params));
}

export default async function LocalizedProducts(props: PageProps<"/[lang]/products">) {
  return <ProductsScreen lang={await intlLang(props.params)} />;
}
