import type { Metadata } from "next";
import ContactsScreen, { contactsMetadata } from "./screen";

// Контакты. Тело — в `screen.tsx`: там его рисуют и тесты, без маршрута.

export const metadata: Metadata = contactsMetadata();

export default function ContactsPage() {
  return <ContactsScreen />;
}
