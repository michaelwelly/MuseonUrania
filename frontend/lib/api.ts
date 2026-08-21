// Клиент публичного API бэкенда.
//
// Каталог, новости и документы читаются на сборке и обновляются раз в пять
// минут — тот же срок, что бэкенд ставит в `Cache-Control`. Поэтому падение
// бэкенда не роняет уже собранный сайт: свойство №1 из спеки серверной части.
// Живой бэкенд нужен только формам и Ведалине, они ходят из браузера.
//
// Что происходит, если API недоступен:
//
// - `NEXT_PUBLIC_API_URL` не задан — источником остаётся `content/*.ts`.
//   Это рабочий режим вёрстки: фронтенд поднимается без Docker, базы и
//   бэкенда, и Егору не нужно поднимать серверную часть, чтобы поправить
//   отступ.
// - адрес задан, но API не ответил — сборка падает. Тихо подставить
//   захардкоженный каталог здесь опаснее, чем не собраться: снятая
//   с публикации позиция уехала бы на прод как опубликованная.

import { products as localProducts } from "@/content/products";
import { news as localNews } from "@/content/news";
import { documents as localDocuments } from "@/content/documents";

export type Spec = { label: string; value: string; muted?: boolean };

export type Product = {
  slug: string;
  name: string;
  kind: string;
  categories: string[];
  status: "confirmed" | "pending";
  summary: string;
  image?: { src: string; alt: string };
  detail?: string;
  /** Назначение. undefined — текста ещё нет, карточка покажет «ожидает уточнения». */
  purpose?: string;
  /** Ключевые особенности. Пустой список приходит как undefined — см. toProduct. */
  features?: string[];
  keyParams?: Spec[];
  specs?: Spec[];
};

export type NewsItem = {
  slug: string;
  date: string;
  tag: string;
  title: string;
  excerpt: string;
  image?: { src: string; alt: string };
};

/** Новость целиком: то же самое плюс текст материала. */
export type NewsEntry = NewsItem & {
  /** Дата в формате ISO — для тега <time>, который читают машины. */
  isoDate: string;
  body?: string;
};

export type Doc = {
  slug: string;
  title: string;
  group: string;
  product: string;
  access: string;
  published: boolean;
  file?: string;
};

const trim = (value: string | undefined) => (value ?? "").replace(/\/+$/, "");

/** Адрес для браузера: формы, Ведалина, админка. Он же адрес по умолчанию. */
export const apiUrl = trim(process.env.NEXT_PUBLIC_API_URL);

// Адрес для сборки. Этот модуль работает на сервере, и в контейнере ему нужен
// внутренний адрес портала: `localhost:8080` изнутри контейнера ведёт в сам
// контейнер, а `portal:8081` из браузера не резолвится. Один адрес на оба
// случая невозможен, поэтому их два.
//
// Переменная НЕ `NEXT_PUBLIC_`: внутреннее имя хоста не должно уехать
// в клиентский бандл. Не задана — берётся публичный адрес, и всё работает
// как раньше.
const buildUrl = trim(process.env.VEDAL_API_INTERNAL_URL) || apiUrl;

/** Адрес API задан — значит, источник данных бэкенд, а не `content/*.ts`. */
export const apiConfigured = buildUrl !== "";

// Пять минут совпадают с max-age бэкенда. Разъедутся — сайт будет держать
// снятую с публикации позицию дольше, чем рассчитывает бэкенд.
const REVALIDATE = 300;

async function get<T>(path: string): Promise<T> {
  const url = `${buildUrl}${path}`;
  let response: Response;

  try {
    response = await fetch(url, { next: { revalidate: REVALIDATE } });
  } catch (cause) {
    // Причину оборачиваем, но не глотаем: без адреса в сообщении непонятно,
    // куда именно не достучались.
    throw new Error(`Публичное API недоступно: ${url}`, { cause });
  }

  if (!response.ok) {
    throw new Error(`Публичное API ответило ${response.status}: ${url}`);
  }

  return response.json() as Promise<T>;
}

// ————— каталог —————

type ApiSpec = { label: string; value: string; muted: boolean };

type ApiCard = {
  slug: string;
  name: string;
  kind: string;
  summary: string;
  docStatus: string;
  categories: string[];
  imageSrc: string | null;
  imageAlt: string | null;
};

type ApiDetail = ApiCard & {
  detail: string | null;
  purpose: string | null;
  features: string[];
  keyParams: ApiSpec[];
  specs: ApiSpec[];
};

// `muted` наружу отдаётся всегда, внутри фронтенда это необязательное поле:
// в разметке проверяется истинность, а не наличие.
const toSpec = (s: ApiSpec): Spec => ({ label: s.label, value: s.value, muted: s.muted });

function toProduct(card: ApiCard): Product {
  return {
    slug: card.slug,
    name: card.name,
    kind: card.kind,
    categories: card.categories,
    // docStatus и published — разные флаги бэкенда. Сюда приезжает первый:
    // второй уже отфильтровал ответ, неопубликованного в нём нет.
    status: card.docStatus === "confirmed" ? "confirmed" : "pending",
    summary: card.summary,
    image: card.imageSrc ? { src: card.imageSrc, alt: card.imageAlt ?? "" } : undefined,
  };
}

export async function fetchProducts(): Promise<Product[]> {
  if (!apiConfigured) return localProducts;
  const cards = await get<ApiCard[]>("/api/public/v1/products");
  return cards.map(toProduct);
}


/**
 * Ключ ресурса в адресе API.
 *
 * Сегмент маршрута приезжает из Next в том виде, в каком стоял в адресе, —
 * то есть уже процентно-закодированным. Ещё одно кодирование превращает
 * `%D0%BD` в `%25D0%25BD`, и в API уходит не тот ключ. На латинских slug это
 * незаметно: экранировать там нечего. На кириллическом адресе портал отвечал
 * четырёхсотой, а страница падала пятисотой вместо «не найдено».
 *
 * Поэтому декодируем перед тем, как закодировать. Некорректная
 * последовательность — ссылка в cp1251, забредший бот — роняет
 * decodeURIComponent; такой ключ ничего не именует, и он уходит в API как
 * обычный текст, чтобы вернуться оттуда честной 404, а не ошибкой сервера.
 */
function slugParam(slug: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(slug));
  } catch {
    return encodeURIComponent(slug);
  }
}
export async function fetchProduct(slug: string): Promise<Product | null> {
  if (!apiConfigured) return localProducts.find((p) => p.slug === slug) ?? null;

  // buildUrl, а не apiUrl: этот запрос идёт на сборке, из процесса Node.
  // Собственный fetch здесь нужен ради разбора 404 — общий get() на нём
  // бросает исключение, а неопубликованное изделие это не сбой.
  const url = `${buildUrl}/api/public/v1/products/${slugParam(slug)}`;
  const response = await fetch(url, { next: { revalidate: REVALIDATE } });

  // 404 — это не сбой, а неопубликованное или несуществующее изделие.
  // Страница обязана показать 404, а не упасть сборкой.
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Публичное API ответило ${response.status}: ${url}`);

  const detail = (await response.json()) as ApiDetail;
  return {
    ...toProduct(detail),
    detail: detail.detail ?? undefined,
    purpose: detail.purpose ?? undefined,
    // Пустой список сводится к undefined, как keyParams и specs ниже: разметка
    // проверяет наличие блока, а не длину массива, и пустой массив нарисовал
    // бы заголовок «Ключевые особенности» над пустотой.
    features: detail.features.length ? detail.features : undefined,
    keyParams: detail.keyParams.length ? detail.keyParams.map(toSpec) : undefined,
    specs: detail.specs.length ? detail.specs.map(toSpec) : undefined,
  };
}

// fetchCategories убрана 19 августа вместе с фильтром каталога — она читала
// список направлений только ради его чипов. Направления никуда не делись:
// они лежат у каждого изделия в поле categories и подписывают карточку.
// Эндпоинт /api/public/v1/categories жив, админка направлениями управляет.

// ————— новости —————

type ApiNews = {
  slug: string;
  tag: string;
  title: string;
  excerpt: string;
  publishedOn: string;
  imageSrc: string | null;
  imageAlt: string | null;
};

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

// Бэкенд отдаёт дату как `2026-08-13`, лента показывает её словами.
// Формат — забота интерфейса, поэтому разбираем строку здесь, а не там.
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export async function fetchNews(): Promise<NewsItem[]> {
  if (!apiConfigured) {
    return localNews.map((item) => ({ ...item, slug: "", tag: item.tag }));
  }
  const cards = await get<ApiNews[]>("/api/public/v1/news");
  return cards.map((c) => ({
    slug: c.slug,
    date: formatDate(c.publishedOn),
    tag: c.tag,
    title: c.title,
    excerpt: c.excerpt,
    image: c.imageSrc ? { src: c.imageSrc, alt: c.imageAlt ?? "" } : undefined,
  }));
}

// Отдельная запись читается по slug: списочный ответ текста не содержит,
// и тянуть весь список ради одного материала значит грузить ленту целиком
// на каждую страницу новости.
//
// Возвращает null на 404 — неопубликованной новости для сайта не существует,
// и страница отвечает notFound(), а не падает пятисотой.
export async function fetchNewsEntry(slug: string): Promise<NewsEntry | null> {
  if (!apiConfigured) return null;

  // buildUrl и revalidate — как в fetchProduct рядом: запрос идёт на сборке,
  // а собственный fetch нужен ради разбора 404 (общий get() на нём бросает).
  const url = `${buildUrl}/api/public/v1/news/${slugParam(slug)}`;
  const response = await fetch(url, { next: { revalidate: REVALIDATE } });

  // 404 — неопубликованный или несуществующий материал, а не сбой сборки.
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Публичное API ответило ${response.status}: ${url}`);

  const item = (await response.json()) as ApiNews & { body: string | null };
  return {
    slug: item.slug,
    isoDate: item.publishedOn,
    date: formatDate(item.publishedOn),
    tag: item.tag,
    title: item.title,
    excerpt: item.excerpt,
    body: item.body ?? undefined,
    image: item.imageSrc ? { src: item.imageSrc, alt: item.imageAlt ?? "" } : undefined,
  };
}

// ————— документы —————

type ApiDoc = {
  slug: string;
  title: string;
  group: string;
  subject: string;
  productSlug: string | null;
  access: string;
  published: boolean;
  fileUrl: string | null;
};

// Бэкенд хранит код доступа, сайт показывает подпись. Перевод здесь:
// подпись — это интерфейс, её меняют без миграции.
const ACCESS_LABEL: Record<string, string> = {
  pdf: "PDF",
  on_request: "По запросу",
  pending: "Уточняется",
};

export async function fetchDocuments(): Promise<Doc[]> {
  if (!apiConfigured) {
    return localDocuments.map((d) => ({
      slug: "",
      title: d.title,
      group: d.group,
      product: d.product,
      access: d.access,
      published: d.published,
      file: d.file,
    }));
  }

  const cards = await get<ApiDoc[]>("/api/public/v1/documents");
  return cards.map((c) => ({
    slug: c.slug,
    title: c.title,
    group: c.group,
    product: c.subject,
    access: ACCESS_LABEL[c.access] ?? c.access,
    published: c.published,
    // Ссылку на файл строит бэкенд и только у опубликованных: собирать её
    // здесь значит однажды собрать её для закрытого документа.
    //
    // Здесь apiUrl, а не buildUrl, и это не описка: по этой ссылке пойдёт
    // браузер посетителя, а не сборка. Внутренний адрес портала в разметке
    // страницы означал бы ссылку, которая не открывается ни у кого.
    file: c.fileUrl ? `${apiUrl}${c.fileUrl}` : undefined,
  }));
}
