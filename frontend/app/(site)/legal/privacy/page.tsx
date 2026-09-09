import type { Metadata } from "next";
import PrivacyScreen, { privacyMetadata } from "./screen";

// Политика обработки персональных данных. Тело — в `screen.tsx`: там его
// рисуют и тесты, без маршрута.

export const metadata: Metadata = privacyMetadata();

export default function PrivacyPage() {
  return <PrivacyScreen />;
}
