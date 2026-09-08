import type { Metadata } from "next";
import ProductionScreen, { productionMetadata } from "./screen";
import { DEFAULT_LANG } from "@/lib/i18n";

// Русская страница «Производство». Тело — в `screen.tsx`: его же рисуют
// `/en/production/` и `/zh/production/`.

export const metadata: Metadata = productionMetadata(DEFAULT_LANG);

export default function Production() {
  return <ProductionScreen lang={DEFAULT_LANG} />;
}
