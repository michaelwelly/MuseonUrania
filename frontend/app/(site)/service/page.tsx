import type { Metadata } from "next";
import ServiceScreen, { serviceMetadata } from "./screen";

// Сервис. Тело — в `screen.tsx`: там его рисуют и тесты, без маршрута.

export const metadata: Metadata = serviceMetadata();

export default function Service() {
  return <ServiceScreen />;
}
