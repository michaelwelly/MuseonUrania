// Откуда сайт берёт фотографии.
//
// Задан `NEXT_PUBLIC_MEDIA_URL` — файлы едут из объектного хранилища
// (Yandex Object Storage). Разговор с ним идёт по S3, поэтому смена
// провайдера меняет адрес, а не код.
//
// В контенте и в базе хранится **путь** (`/photos/products/vedal-r1.jpg`),
// а не полный адрес. Причина та же, по которой бэкенд держит хранилище за
// портом: имя хоста — свойство окружения. Сложи его в базу, и перенос на
// другой бакет или подключение CDN превращаются в миграцию данных.
//
// Без `NEXT_PUBLIC_MEDIA_URL` путь остаётся как есть, и Next отдаёт файл из
// `public/`. Это рабочий режим вёрстки: картинки на месте без Docker и
// хранилища.

const base = (process.env.NEXT_PUBLIC_MEDIA_URL ?? "").replace(/\/+$/, "");

/** Каталог с фотографиями. Знак, логотип и аватар Ведалины сюда не попадают —
 *  они часть оформления и живут в репозитории вместе с кодом. */
const MEDIA_PREFIX = "/photos/";

export function mediaSrc(src: string): string {
  if (!base || !src.startsWith(MEDIA_PREFIX)) return src;
  return `${base}${src}`;
}

/** Хост хранилища для `images.remotePatterns` в next.config.ts. */
export const mediaOrigin = base;
