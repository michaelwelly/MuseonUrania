import type { Metadata } from "next";
import ServiceScreen, { serviceMetadata } from "./screen";
import { DEFAULT_LANG } from "@/lib/i18n";

// Русская страница «Сервис». Тело — в `screen.tsx`: его же рисуют
// `/en/service/` и `/zh/service/`.

export const metadata: Metadata = serviceMetadata(DEFAULT_LANG);

export default function Service() {
  return <ServiceScreen lang={DEFAULT_LANG} />;
}
