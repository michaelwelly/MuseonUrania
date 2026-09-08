"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { tags, expected } from "@/content/news";
import { ui } from "@/content/ui";
import type { NewsItem } from "@/lib/api";
import { contentText } from "@/lib/content-i18n";
import { localePath, type Lang } from "@/lib/i18n";
import styles from "./page.module.css";
import { mediaSrc } from "@/lib/media";

// Чипы рубрик и лента. Публикаций пока нет — фильтр всё равно нужен,
// иначе при появлении первой записи придётся переписывать разметку.
// Записи приходят сверху: их читает серверный компонент на сборке.
// Ссылка или неподвижная карточка — решает наличие slug. Обёртка вынесена,
// чтобы разметка карточки не дублировалась в двух ветках условия: разъехались
// бы при первой же правке.
//
// Язык доезжает сюда пропом, потому что ссылка на материал живёт внутри
// обёртки: `/news/x/` для русского и `/en/news/x/` для английского.
function CardShell({
  slug,
  lang,
  children,
}: {
  slug: string;
  lang: Lang;
  children: React.ReactNode;
}) {
  return slug ? (
    <Link className={styles.card} href={localePath(lang, `/news/${slug}/`)}>
      {children}
    </Link>
  ) : (
    <article className={styles.card}>{children}</article>
  );
}

export default function NewsFeed({ news, lang }: { news: NewsItem[]; lang: Lang }) {
  // Фильтр держит русский оригинал рубрики: сравнение идёт с полем `tag`
  // из API, и после перевода чипа оно бы не совпало ни с одной записью.
  const [active, setActive] = useState<string | null>(null);
  const shown = active ? news.filter((n) => n.tag === active) : news;
  const strings = ui(lang);
  const c = contentText(lang);

  return (
    <>
      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.chip} ${active === null ? styles.chipActive : ""}`}
          onClick={() => setActive(null)}
          aria-pressed={active === null}
        >
          {strings.news.all}
        </button>
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.chip} ${active === t ? styles.chipActive : ""}`}
            onClick={() => setActive(t)}
            aria-pressed={active === t}
            lang={c.mark(t)}
          >
            {c.t(t)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className={styles.empty} data-reveal="0">
          <p className={styles.emptyTitle}>{strings.news.emptyTitle}</p>
          <p className={styles.emptyText} lang={c.mark(NEWS_PLAN)}>
            {c.t(NEWS_PLAN)}
          </p>
          <ul className={styles.expected}>
            {expected.map((item) => (
              <li key={item} lang={c.mark(item)}>
                {c.t(item)}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className={styles.feed} data-reveal="0">
          {shown.map((item) => (
            <li key={item.slug || item.title}>
              {/* Карточка ведёт на материал целиком. Без slug ссылки нет:
                  локальная заглушка из content/news.ts отдаёт пустой slug,
                  и ссылка на /news// вела бы в 404. */}
              <CardShell slug={item.slug} lang={lang}>
                <div className={styles.cardPhoto}>
                  {item.image && (
                    <Image
                      src={mediaSrc(item.image.src)}
                      alt={c.t(item.image.alt)}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
                    />
                  )}
                </div>
                {/* Рубрика, заголовок и анонс — текст материала. Помечаем
                    карточку разом: если хоть одна строка осталась
                    оригиналом, читается она по-русски. Дата не переводится:
                    её собирает портал. */}
                <div className={styles.cardBody} lang={c.mark(item.tag, item.title, item.excerpt)}>
                  <div className={styles.cardMeta}>
                    <span className={styles.tag}>{c.t(item.tag)}</span>
                    <span className={styles.date}>{item.date}</span>
                  </div>
                  <h2 className={styles.cardTitle}>{c.t(item.title)}</h2>
                  <p className={styles.cardExcerpt}>{c.t(item.excerpt)}</p>
                </div>
              </CardShell>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// Планы по наполнению раздела: называет Иннопром и ожидание исходников от
// компании. Утверждение о её работе, значит — содержательный текст, а не
// подпись пустого состояния.
const NEWS_PLAN =
  "Раздел готов к наполнению. Первым материалом планируется релиз по Иннопрому — ждём исходники от компании.";
