import type { Metadata } from "next";
import ArchiveScreen, { archiveMetadata } from "./screen";

// Фотоархив производства. Тело — в `screen.tsx`: там его рисуют и тесты.

export const metadata: Metadata = archiveMetadata();

export default function Archive() {
  return <ArchiveScreen />;
}
