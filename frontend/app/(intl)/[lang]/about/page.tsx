import type { Metadata } from "next";
import AboutScreen, { aboutMetadata } from "@/app/(site)/about/screen";
import { intlLang } from "@/lib/intl-route";

// «О компании» на английском и китайском: `/en/about/`, `/zh/about/`.
//
// Тело страницы одно на все языки — `app/(site)/about/screen.tsx`.
// Здесь только разбор языка из адреса.

export async function generateMetadata(props: PageProps<"/[lang]/about">): Promise<Metadata> {
  return aboutMetadata(await intlLang(props.params));
}

export default async function LocalizedAbout(props: PageProps<"/[lang]/about">) {
  return <AboutScreen lang={await intlLang(props.params)} />;
}
