import type { Metadata } from "next";
import HomeScreen, { homeMetadata } from "./screen";
import { DEFAULT_LANG } from "@/lib/i18n";

// Русская главная. Тело — в `screen.tsx`: его же рисует `/en/` и `/zh/`.

export const metadata: Metadata = homeMetadata(DEFAULT_LANG);

export default function Home() {
  return <HomeScreen lang={DEFAULT_LANG} />;
}
