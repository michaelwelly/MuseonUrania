import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import TranslationNotice from "@/components/TranslationNotice";
import { ui } from "@/content/ui";
import { fetchNewsEntry } from "@/lib/api";
import { contentText } from "@/lib/content-i18n";
import { localePath, type Lang } from "@/lib/i18n";
import { mediaSrc } from "@/lib/media";
import { pageMetadata } from "@/lib/seo";
import styles from "./page.module.css";

// §8.3 плана: согласованный формат новости — заголовок, краткий анонс, полный
// текст, изображения, документы/ссылки и SEO. Страницы под материал не было
// вовсе: бэкенд отдавал /news/{slug} с текстом, админка текст принимала,
// а показать его сайту было негде — лента обрывалась на анонсе.
//
// Чего здесь пока нет: блока документов и ссылок к материалу. Под них нет
// модели, а придумывать её до согласования формата — угадывать. Оставлено
// вопросом к заказчику, а не заглушкой в разметке.
//
// Тело вынесено из `page.tsx` в `screen.tsx`: его рисуют два маршрута —
// `/news/[slug]/` и `/[lang]/news/[slug]/`. Сам текст материала пишет
// редактор по-русски; перевод его — новая редакция пресс-релиза, и делает
// её заказчик, а не сайт. До перевода показывается русский оригинал.

export async function newsEntryMetadata(slug: string, lang: Lang): Promise<Metadata> {
  const entry = await fetchNewsEntry(slug);
  if (!entry) return {};
  const c = contentText(lang);

  // SEO собирается из заголовка и анонса. Отдельных полей title/description
  // у новости нет: §8.3 их называет, но формат ещё не согласован, и пока
  // анонс — честный источник описания, он для того и написан.
  return pageMetadata({
    title: `${c.t(entry.title)} — VEDAL`,
    description: c.t(entry.excerpt),
    // Путь без языкового префикса: его дописывает `pageMetadata` вместе
    // с canonical и hreflang.
    path: `/news/${entry.slug}/`,
    lang,
    type: "article",
    publishedTime: entry.isoDate,
    image: entry.image
      ? { url: mediaSrc(entry.image.src), alt: c.t(entry.image.alt) }
      : undefined,
  });
}

export default async function NewsEntryScreen({ slug, lang }: { slug: string; lang: Lang }) {
  const entry = await fetchNewsEntry(slug);
  // Неопубликованный материал для сайта не существует — 404, а не пустая
  // страница: по коду ответа не должно быть видно, что черновик есть.
  if (!entry) notFound();

  const strings = ui(lang);
  const c = contentText(lang);
  const at = (path: string) => localePath(lang, path);
  // Абзацы делятся пустой строкой. Разметку из текста не разбираем:
  // редактор пишет в админке обычный текст, и трактовать его как HTML
  // значило бы отдать вёрстку страницы тому, кто про неё не думает, —
  // и открыть вставку произвольной разметки.
  const paragraphs = (entry.body ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <main className={styles.page}>
      <p className={styles.crumbs}>
        <Link href={at("/")}>{strings.crumbs.home}</Link> /{" "}
        <Link href={at("/news/")}>{strings.crumbs.news}</Link> /{" "}
        <span lang={c.mark(entry.tag)}>{c.t(entry.tag)}</span>
      </p>

      {/* Примечание стоит сразу после хлебных крошек — до заголовка:
          на этой странице первый же экран и есть текст материала,
          и объяснить кириллицу надо раньше, чем она встретится. */}
      <TranslationNotice lang={lang} />

      <article className={styles.article}>
        <header className={styles.head}>
          <div className={styles.meta}>
            <span className={styles.tag} lang={c.mark(entry.tag)}>
              {c.t(entry.tag)}
            </span>
            {/* dateTime в ISO — дата для машин, текст рядом для людей. */}
            <time className={styles.date} dateTime={entry.isoDate}>
              {entry.date}
            </time>
          </div>
          <h1
            className={styles.title}
            data-words="34"
            data-wdelay="110"
            lang={c.mark(entry.title)}
          >
            {c.t(entry.title)}
          </h1>
          <p className={styles.excerpt} lang={c.mark(entry.excerpt)}>
            {c.t(entry.excerpt)}
          </p>
        </header>

        {entry.image && (
          <div className={styles.photo}>
            <Image
              src={mediaSrc(entry.image.src)}
              alt={c.t(entry.image.alt)}
              fill
              sizes="(max-width: 1100px) 100vw, 60vw"
              priority
            />
          </div>
        )}

        {paragraphs.length > 0 ? (
          // Пометка на всём тексте, а не на каждом абзаце: перевод материала
          // согласуется целиком, и половина переведённой новости — это не то
          // состояние, ради которого стоит городить разметку.
          <div className={styles.body} lang={c.mark(...paragraphs)}>
            {paragraphs.map((p) => (
              <p key={p}>{c.t(p)}</p>
            ))}
          </div>
        ) : (
          <p className={styles.awaiting} lang={c.mark(BODY_AWAITING)}>
            {c.t(BODY_AWAITING)}
          </p>
        )}
      </article>

      <div className={styles.back}>
        <Link href={at("/news/")}>{strings.actions.backToNews}</Link>
      </div>
    </main>
  );
}

// Состояние самого материала, а не интерфейса: строка говорит, что текст
// опубликован не целиком и ждёт согласования. «Ожидает уточнения» —
// термин проекта, и переводится он вместе с текстом, а не отдельно.
const BODY_AWAITING =
  "Полный текст материала — ожидает уточнения. Опубликован анонс; развёрнутый текст появится после согласования.";
