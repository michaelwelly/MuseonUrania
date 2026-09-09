import type { Metadata } from "next";
import DocumentsScreen, { documentsMetadata } from "./screen";

// Документы. Тело — в `screen.tsx`: там его рисуют и тесты, без маршрута.

export const metadata: Metadata = documentsMetadata();

export default function DocumentsPage() {
  return <DocumentsScreen />;
}
