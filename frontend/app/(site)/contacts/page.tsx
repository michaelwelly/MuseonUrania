import type { Metadata } from "next";
import ContactsScreen, { contactsMetadata } from "./screen";
import { DEFAULT_LANG } from "@/lib/i18n";

// Русские контакты. Тело — в `screen.tsx`: его же рисуют `/en/contacts/`
// и `/zh/contacts/`.

export const metadata: Metadata = contactsMetadata(DEFAULT_LANG);

export default function ContactsPage() {
  return <ContactsScreen lang={DEFAULT_LANG} />;
}
