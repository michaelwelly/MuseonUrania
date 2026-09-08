import type { MetadataRoute } from "next";

import { fetchNews, fetchProducts } from "@/lib/api";
import { alternateLanguages, DEFAULT_LANG, localePath, PUBLISHED_LANGS } from "@/lib/i18n";
import { publicSite } from "@/lib/seo";

// Карта сайта.
//
// Собирается из того же источника, что и сами страницы, — из портала.
// Список руками разъехался бы с каталогом на первой же снятой с публикации
// карточке: изделие исчезло бы с сайта и осталось в карте, а поисковик
// ходил бы за ним до 404.
//
// Неопубликованного здесь нет по устройству: публичное API отдаёт только
// опубликованное, и отдельной проверки на это не нужно.
//
// Адреса — со слэшем на конце: в `next.config.ts` включён `trailingSlash`,
// и адрес без него отвечает 308. Карта, ведущая на редирект, работает,
// но заставляет обходчика ходить дважды за каждой страницей.
//
// ───────────────────────────────────────────────────────────────────────────
// Три языка в одной карте
//
// Каждая страница попадает сюда трижды — `/products/`, `/en/products/`,
// `/zh/products/` — и у каждой записи стоит `alternates.languages` со всеми
// тремя адресами. Это то же самое `hreflang`, что и в разметке страницы,
// и повторено оно намеренно: поисковик берёт связь версий из того источника,
// который прочитал первым, а карту он читает раньше страниц.
//
// Отдельной карты на язык нет: она понадобилась бы, если бы наборы страниц
// расходились. Они не расходятся — переведённые версии повторяют русскую
// страница в страницу, включая карточки изделий и новостей.

/** Раз в час: каталог и новости меняются реже, а карта не бесплатна. */
export const revalidate = 3600;

/** Страницы, которых нет в базе: они существуют всегда. */
const STATIC: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/products/", priority: 0.9, changeFrequency: "weekly" },
  { path: "/about/", priority: 0.7, changeFrequency: "monthly" },
  { path: "/production/", priority: 0.7, changeFrequency: "monthly" },
  { path: "/service/", priority: 0.7, changeFrequency: "monthly" },
  { path: "/documents/", priority: 0.6, changeFrequency: "weekly" },
  { path: "/news/", priority: 0.6, changeFrequency: "weekly" },
  { path: "/contacts/", priority: 0.5, changeFrequency: "monthly" },
  { path: "/legal/privacy/", priority: 0.2, changeFrequency: "yearly" },
];

/**
 * Абсолютные адреса версий одной страницы для `alternates.languages`.
 *
 * `alternateLanguages` отдаёт пути; карта требует абсолютных адресов,
 * поэтому здесь к ним приписывается домен.
 */
function languagesOf(path: string): Record<string, string> {
  const absolute: Record<string, string> = {};
  for (const [tag, href] of Object.entries(alternateLanguages(path))) {
    absolute[tag] = `${publicSite}${href}`;
  }
  return absolute;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Нет боевого адреса — нет и карты. Она обязана быть из абсолютных
  // адресов, а единственный абсолютный адрес, который тут можно назвать
  // без него, — это адрес стенда. См. `publicSite` в lib/seo.
  if (!publicSite) return [];

  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  /** Одна страница — три записи: по одной на язык, с общим списком версий. */
  const push = (
    path: string,
    priority: number,
    changeFrequency: "daily" | "weekly" | "monthly" | "yearly",
  ) => {
    const languages = languagesOf(path);
    for (const lang of PUBLISHED_LANGS) {
      entries.push({
        url: `${publicSite}${localePath(lang, path)}`,
        lastModified: now,
        changeFrequency,
        // Переведённые версии чуть ниже русской: она полная, а в остальных
        // содержательные тексты пока показываются русским оригиналом.
        // Приоритет — не ранжирование, а подсказка обходчику, куда идти
        // раньше; идти раньше стоит туда, где текст согласован.
        priority: lang === DEFAULT_LANG ? priority : Math.round(priority * 0.8 * 100) / 100,
        alternates: { languages },
      });
    }
  };

  for (const { path, priority, changeFrequency } of STATIC) {
    push(path, priority, changeFrequency);
  }

  // Портал может не ответить — сборка карты не повод ронять её целиком:
  // статические страницы в ней ценнее пустого ответа. Пустая карта читается
  // поисковиком как «страниц не осталось».
  const [products, news] = await Promise.all([
    fetchProducts().catch(() => []),
    fetchNews().catch(() => []),
  ]);

  for (const product of products) {
    push(`/products/${product.slug}/`, 0.8, "monthly");
  }

  for (const item of news) {
    // Без slug'а материал приезжает только в режиме вёрстки без бэкенда,
    // где карта и так не собирается. Проверка — на случай, если такой
    // ответ придёт от портала: адрес `/news//` вёл бы в никуда.
    if (!item.slug) continue;
    push(`/news/${item.slug}/`, 0.5, "yearly");
  }

  return entries;
}
