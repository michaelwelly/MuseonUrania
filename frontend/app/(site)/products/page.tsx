import type { Metadata } from "next";
import ProductsScreen, { productsMetadata } from "./screen";
import { DEFAULT_LANG } from "@/lib/i18n";

// Русский каталог. Тело — в `screen.tsx`: его же рисуют `/en/products/`
// и `/zh/products/`.

export const metadata: Metadata = productsMetadata(DEFAULT_LANG);

export default function ProductsPage() {
  return <ProductsScreen lang={DEFAULT_LANG} />;
}
