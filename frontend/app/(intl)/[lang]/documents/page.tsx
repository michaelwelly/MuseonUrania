import type { Metadata } from "next";
import DocumentsScreen, { documentsMetadata } from "@/app/(site)/documents/screen";
import { intlLang } from "@/lib/intl-route";

// Документы на английском и китайском: `/en/documents/`, `/zh/documents/`.
//
// Тело страницы одно на все языки — `app/(site)/documents/screen.tsx`.
// Здесь только разбор языка из адреса.

export async function generateMetadata(
  props: PageProps<"/[lang]/documents">,
): Promise<Metadata> {
  return documentsMetadata(await intlLang(props.params));
}

export default async function LocalizedDocuments(props: PageProps<"/[lang]/documents">) {
  return <DocumentsScreen lang={await intlLang(props.params)} />;
}
