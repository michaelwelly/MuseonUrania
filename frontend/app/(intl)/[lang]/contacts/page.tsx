import type { Metadata } from "next";
import ContactsScreen, { contactsMetadata } from "@/app/(site)/contacts/screen";
import { intlLang } from "@/lib/intl-route";

// Контакты на английском и китайском: `/en/contacts/`, `/zh/contacts/`.
//
// Тело страницы одно на все языки — `app/(site)/contacts/screen.tsx`.
// Здесь только разбор языка из адреса.

export async function generateMetadata(
  props: PageProps<"/[lang]/contacts">,
): Promise<Metadata> {
  return contactsMetadata(await intlLang(props.params));
}

export default async function LocalizedContacts(props: PageProps<"/[lang]/contacts">) {
  return <ContactsScreen lang={await intlLang(props.params)} />;
}
