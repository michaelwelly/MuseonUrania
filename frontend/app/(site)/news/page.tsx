import type { Metadata } from "next";
import NewsScreen, { newsMetadata } from "./screen";
import { DEFAULT_LANG } from "@/lib/i18n";

// Русские новости. Тело — в `screen.tsx`: его же рисуют `/en/news/`
// и `/zh/news/`.

export const metadata: Metadata = newsMetadata(DEFAULT_LANG);

export default function NewsPage() {
  return <NewsScreen lang={DEFAULT_LANG} />;
}
