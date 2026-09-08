import type { Metadata } from "next";
import DocumentsScreen, { documentsMetadata } from "./screen";
import { DEFAULT_LANG } from "@/lib/i18n";

// Русские документы. Тело — в `screen.tsx`: его же рисуют `/en/documents/`
// и `/zh/documents/`.

export const metadata: Metadata = documentsMetadata(DEFAULT_LANG);

export default function DocumentsPage() {
  return <DocumentsScreen lang={DEFAULT_LANG} />;
}
