import type { Metadata } from "next";
import NewsEntryScreen, { newsEntryMetadata } from "@/app/(site)/news/[slug]/screen";
import { fetchNews } from "@/lib/api";
import { intlLang } from "@/lib/intl-route";

// Материал новости на английском и китайском: `/en/news/[slug]/`,
// `/zh/news/[slug]/`. Тело — `app/(site)/news/[slug]/screen.tsx`.

/**
 * Только `slug`, без языка.
 *
 * Языки перечисляет `generateStaticParams` в `app/(intl)/[lang]/layout.tsx`,
 * и Next перемножает списки сам: два языка на N материалов. Вернув отсюда
 * ещё и `lang`, мы завели бы второе место, где список языков надо править,
 * — а разошлись бы они молча, отсутствующей китайской страницей.
 */
export async function generateStaticParams() {
  const news = await fetchNews();
  return news.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata(
  props: PageProps<"/[lang]/news/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  return newsEntryMetadata(slug, await intlLang(props.params));
}

export default async function LocalizedNewsEntry(props: PageProps<"/[lang]/news/[slug]">) {
  const { slug } = await props.params;
  return <NewsEntryScreen slug={slug} lang={await intlLang(props.params)} />;
}
