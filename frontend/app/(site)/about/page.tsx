import type { Metadata } from "next";
import AboutScreen, { aboutMetadata } from "./screen";
import { DEFAULT_LANG } from "@/lib/i18n";

// Русская страница «О компании». Тело — в `screen.tsx`: его же рисуют
// `/en/about/` и `/zh/about/`.

export const metadata: Metadata = aboutMetadata(DEFAULT_LANG);

export default function About() {
  return <AboutScreen lang={DEFAULT_LANG} />;
}
