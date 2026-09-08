import type { Metadata } from "next";
import HomeScreen, { homeMetadata } from "@/app/(site)/screen";
import { intlLang } from "@/lib/intl-route";

// Главная на английском и китайском: `/en/`, `/zh/`.
//
// Тело страницы одно на все языки — `app/(site)/screen.tsx`. Здесь только
// разбор языка из адреса; так же устроены остальные восемь маршрутов.

export async function generateMetadata(props: PageProps<"/[lang]">): Promise<Metadata> {
  return homeMetadata(await intlLang(props.params));
}

export default async function LocalizedHome(props: PageProps<"/[lang]">) {
  return <HomeScreen lang={await intlLang(props.params)} />;
}
