import type { Metadata } from "next";
import ProductsScreen, { productsMetadata } from "./screen";

// Каталог. Тело — в `screen.tsx`: там его рисуют и тесты, без маршрута.

export const metadata: Metadata = productsMetadata();

export default function ProductsPage() {
  return <ProductsScreen />;
}
