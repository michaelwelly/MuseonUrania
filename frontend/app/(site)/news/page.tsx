import type { Metadata } from "next";
import NewsScreen, { newsMetadata } from "./screen";

// Новости. Тело — в `screen.tsx`: там его рисуют и тесты, без маршрута.

export const metadata: Metadata = newsMetadata();

export default function NewsPage() {
  return <NewsScreen />;
}
