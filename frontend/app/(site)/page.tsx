import type { Metadata } from "next";
import HomeScreen, { homeMetadata } from "./screen";

// Главная. Тело — в `screen.tsx`: там его рисуют и тесты, без маршрута.

export const metadata: Metadata = homeMetadata();

export default function Home() {
  return <HomeScreen />;
}
