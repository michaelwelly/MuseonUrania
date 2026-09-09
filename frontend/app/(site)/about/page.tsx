import type { Metadata } from "next";
import AboutScreen, { aboutMetadata } from "./screen";

// Страница «О компании». Тело — в `screen.tsx`: там его рисуют и тесты,
// без маршрута.

export const metadata: Metadata = aboutMetadata();

export default function About() {
  return <AboutScreen />;
}
