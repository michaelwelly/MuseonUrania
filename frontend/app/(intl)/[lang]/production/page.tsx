import type { Metadata } from "next";
import ProductionScreen, { productionMetadata } from "@/app/(site)/production/screen";
import { intlLang } from "@/lib/intl-route";

// «Производство» на английском и китайском: `/en/production/`,
// `/zh/production/`.
//
// Тело страницы одно на все языки — `app/(site)/production/screen.tsx`.
// Здесь только разбор языка из адреса.

export async function generateMetadata(props: PageProps<"/[lang]/production">): Promise<Metadata> {
  return productionMetadata(await intlLang(props.params));
}

export default async function LocalizedProduction(props: PageProps<"/[lang]/production">) {
  return <ProductionScreen lang={await intlLang(props.params)} />;
}
