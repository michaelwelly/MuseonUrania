import type { Metadata } from "next";
import ServiceScreen, { serviceMetadata } from "@/app/(site)/service/screen";
import { intlLang } from "@/lib/intl-route";

// «Сервис» на английском и китайском: `/en/service/`, `/zh/service/`.
//
// Тело страницы одно на все языки — `app/(site)/service/screen.tsx`.
// Здесь только разбор языка из адреса.

export async function generateMetadata(props: PageProps<"/[lang]/service">): Promise<Metadata> {
  return serviceMetadata(await intlLang(props.params));
}

export default async function LocalizedService(props: PageProps<"/[lang]/service">) {
  return <ServiceScreen lang={await intlLang(props.params)} />;
}
