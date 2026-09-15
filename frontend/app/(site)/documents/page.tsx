import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DocumentsScreen, { documentsMetadata } from "./screen";
import { publicDocumentsEnabled } from "@/lib/features";

// Документы. Тело — в `screen.tsx`: там его рисуют и тесты, без маршрута.

export const metadata: Metadata = documentsMetadata();

export default function DocumentsPage() {
  if (!publicDocumentsEnabled) notFound();
  return <DocumentsScreen />;
}
