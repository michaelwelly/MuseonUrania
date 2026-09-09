import type { Metadata } from "next";
import ProductionScreen, { productionMetadata } from "./screen";

// Производство. Тело — в `screen.tsx`: там его рисуют и тесты, без маршрута.

export const metadata: Metadata = productionMetadata();

export default function Production() {
  return <ProductionScreen />;
}
