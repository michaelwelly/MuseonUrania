import type { Metadata } from "next";
import NewsScreen, { newsMetadata } from "@/app/(site)/news/screen";
import { intlLang } from "@/lib/intl-route";

// Новости на английском и китайском: `/en/news/`, `/zh/news/`.
//
// Тело страницы одно на все языки — `app/(site)/news/screen.tsx`.
// Здесь только разбор языка из адреса.

export async function generateMetadata(props: PageProps<"/[lang]/news">): Promise<Metadata> {
  return newsMetadata(await intlLang(props.params));
}

export default async function LocalizedNews(props: PageProps<"/[lang]/news">) {
  return <NewsScreen lang={await intlLang(props.params)} />;
}
