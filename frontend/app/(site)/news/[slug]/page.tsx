import type { Metadata } from "next";
import NewsEntryScreen, { newsEntryMetadata } from "./screen";
import { fetchNews } from "@/lib/api";

// Материал новости. Тело — в `screen.tsx`; здесь остаётся разбор `params`:
// адрес читает маршрут, а экран получает уже разобранный slug.

export async function generateStaticParams() {
  const news = await fetchNews();
  return news.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata(props: PageProps<"/news/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return newsEntryMetadata(slug);
}

export default async function NewsEntryPage(props: PageProps<"/news/[slug]">) {
  const { slug } = await props.params;
  return <NewsEntryScreen slug={slug} />;
}
