import type { Metadata } from "next";

// Метаданные для поисковиков и мессенджеров.
//
// Зачем это отдельным модулем, а не полем в каждой странице. Canonical и
// Open Graph — это девять почти одинаковых блоков по десять строк, и
// разъезжаются они молча: забытый siteName или og:url с чужим адресом
// не ломают ни сборку, ни страницу, их видно только в чужой ленте.

const trim = (value: string | undefined) => (value ?? "").replace(/\/+$/, "");

/**
 * Адрес сайта наружу.
 *
 * Отдельная переменная, а не NEXT_PUBLIC_API_URL, хотя сегодня значение
 * то же самое: сайт и API стоят за одним шлюзом. Поэтому API и служит
 * запасным значением — задавать две переменные с одинаковым содержимым
 * незачем. Но в день, когда API переедет на отдельный поддомен, canonical
 * обязан остаться на сайте, и разъедутся они без правки кода.
 *
 * Пусто — режим вёрстки без бэкенда. Тогда canonical и og:url остаются
 * относительными: подставить сюда localhost значило бы выкатить его
 * в разметку и увести поисковик на несуществующий адрес.
 */
export const siteUrl = trim(process.env.NEXT_PUBLIC_SITE_URL) || trim(process.env.NEXT_PUBLIC_API_URL);

/**
 * Картинка по умолчанию — фирменное дерево, 512×512.
 *
 * Отдельной карточки 1200×630 у нас нет, и рисовать её здесь нельзя: это
 * фирменная графика, её делает заказчик. Поэтому берётся существующий файл
 * с настоящими размерами, а тип карточки — summary, под квадрат. Заявить
 * summary_large_image с квадратной картинкой значит показать её обрезанной.
 */
const defaultImage = { url: "/brand/vedal-tree.png", width: 512, height: 512, alt: "VEDAL" };

type PageSeo = {
  title: string;
  description: string;
  /** Путь со слэшем на конце: в next.config стоит trailingSlash, и адрес без него отдаёт 308. */
  path: string;
  /** Своя картинка страницы — снимок изделия или новости. */
  image?: { url: string; alt: string };
  type?: "website" | "article";
  publishedTime?: string;
};

export function pageMetadata({ title, description, path, image, type = "website", publishedTime }: PageSeo): Metadata {
  const picture = image ? [{ url: image.url, alt: image.alt }] : [defaultImage];
  return {
    title,
    description,
    // Сайт доступен по нескольким адресам сразу: локально, по адресу стенда
    // и, позже, по домену. Без canonical это для поисковика три разных сайта
    // с одинаковым содержимым.
    alternates: { canonical: path },
    openGraph: {
      type,
      title,
      description,
      url: path,
      siteName: "VEDAL",
      locale: "ru_RU",
      images: picture,
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      // Своя картинка — это снимок изделия или новости, он широкий.
      // Запасная — квадратное дерево, и под неё нужен summary.
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: picture,
    },
  };
}
