import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchNews, fetchNewsEntry } from "@/lib/api";
import { mediaSrc } from "@/lib/media";
import styles from "./page.module.css";

// §8.3 плана: согласованный формат новости — заголовок, краткий анонс, полный
// текст, изображения, документы/ссылки и SEO. Страницы под материал не было
// вовсе: бэкенд отдавал /news/{slug} с текстом, админка текст принимала,
// а показать его сайту было негде — лента обрывалась на анонсе.
//
// Чего здесь пока нет: блока документов и ссылок к материалу. Под них нет
// модели, а придумывать её до согласования формата — угадывать. Оставлено
// вопросом к заказчику, а не заглушкой в разметке.

export async function generateStaticParams() {
  const news = await fetchNews();
  return news.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata(props: PageProps<"/news/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const entry = await fetchNewsEntry(slug);
  if (!entry) return {};

  // SEO собирается из заголовка и анонса. Отдельных полей title/description
  // у новости нет: §8.3 их называет, но формат ещё не согласован, и пока
  // анонс — честный источник описания, он для того и написан.
  return {
    title: `${entry.title} — VEDAL`,
    description: entry.excerpt,
    openGraph: {
      type: "article",
      title: entry.title,
      description: entry.excerpt,
      publishedTime: entry.isoDate,
      images: entry.image ? [{ url: mediaSrc(entry.image.src), alt: entry.image.alt }] : undefined,
    },
  };
}

export default async function NewsEntryPage(props: PageProps<"/news/[slug]">) {
  const { slug } = await props.params;
  const entry = await fetchNewsEntry(slug);
  // Неопубликованный материал для сайта не существует — 404, а не пустая
  // страница: по коду ответа не должно быть видно, что черновик есть.
  if (!entry) notFound();

  return (
    <main className={styles.page}>
      <p className={styles.crumbs}>
        <Link href="/">Главная</Link> / <Link href="/news/">Новости</Link> / {entry.tag}
      </p>

      <article className={styles.article}>
        <header className={styles.head}>
          <div className={styles.meta}>
            <span className={styles.tag}>{entry.tag}</span>
            {/* dateTime в ISO — дата для машин, текст рядом для людей. */}
            <time className={styles.date} dateTime={entry.isoDate}>
              {entry.date}
            </time>
          </div>
          <h1 className={styles.title} data-words="34" data-wdelay="110">
            {entry.title}
          </h1>
          <p className={styles.excerpt}>{entry.excerpt}</p>
        </header>

        {entry.image && (
          <div className={styles.photo}>
            <Image
              src={mediaSrc(entry.image.src)}
              alt={entry.image.alt}
              fill
              sizes="(max-width: 1100px) 100vw, 60vw"
              priority
            />
          </div>
        )}

        {entry.body ? (
          // Абзацы делятся пустой строкой. Разметку из текста не разбираем:
          // редактор пишет в админке обычный текст, и трактовать его как
          // HTML значило бы отдать вёрстку страницы тому, кто про неё
          // не думает — и открыть вставку произвольной разметки.
          <div className={styles.body}>
            {entry.body
              .split(/\n\s*\n/)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p) => (
                <p key={p}>{p}</p>
              ))}
          </div>
        ) : (
          <p className={styles.awaiting}>
            Полный текст материала — ожидает уточнения. Опубликован анонс; развёрнутый текст
            появится после согласования.
          </p>
        )}
      </article>

      <div className={styles.back}>
        <Link href="/news/">← Все новости</Link>
      </div>
    </main>
  );
}
