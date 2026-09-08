import type { Metadata } from "next";
import PrivacyScreen, { privacyMetadata } from "./screen";
import { DEFAULT_LANG } from "@/lib/i18n";

// Русская политика персональных данных. Тело — в `screen.tsx`: его же рисуют
// `/en/legal/privacy/` и `/zh/legal/privacy/`.

export const metadata: Metadata = privacyMetadata(DEFAULT_LANG);

export default function PrivacyPage() {
  return <PrivacyScreen lang={DEFAULT_LANG} />;
}
