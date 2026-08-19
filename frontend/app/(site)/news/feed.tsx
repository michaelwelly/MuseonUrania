"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { tags, expected } from "@/content/news";
import type { NewsItem } from "@/lib/api";
import styles from "./page.module.css";
import { mediaSrc } from "@/lib/media";

// Чипы рубрик и лента. Публикаций пока нет — фильтр всё равно нужен,
// иначе при появлении первой записи придётся переписывать разметку.
// Записи приходят сверху: их читает серверный компонент на сборке.
// Ссылка или неподвижная карточка — решает наличие slug. Обёртка вынесена,
// чтобы разметка карточки не дублировалась в двух ветках условия: разъехались
// бы при первой же правке.
function CardShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  return slug ? (
    <Link className={styles.card} href={`/news/${slug}/`}>
      {children}
    </Link>
  ) : (
    <article className={styles.card}>{children}</article>
  );
}

export default function NewsFeed({ news }: { news: NewsItem[] }) {
  const [active, setActive] = useState<string | null>(null);
  const shown = active ? news.filter((n) => n.tag === active) : news;

  return (
    <>
      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.chip} ${active === null ? styles.chipActive : ""}`}
          onClick={() => setActive(null)}
          aria-pressed={active === null}
        >
          Все
        </button>
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.chip} ${active === t ? styles.chipActive : ""}`}
            onClick={() => setActive(t)}
            aria-pressed={active === t}
          >
            {t}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className={styles.empty} data-reveal="0">
          <p className={styles.emptyTitle}>Публикаций пока нет</p>
          <p className={styles.emptyText}>
            Раздел готов к наполнению. Первым материалом планируется релиз по Иннопрому — ждём
            исходники от компании.
          </p>
          <ul className={styles.expected}>
            {expected.map((item) => (
              <li key={item}>{item}</li>
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
              <CardShell slug={item.slug}>
                <div className={styles.cardPhoto}>
                  {item.image && (
                    <Image
                      src={mediaSrc(item.image.src)}
                      alt={item.image.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
                    />
                  )}
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardMeta}>
                    <span className={styles.tag}>{item.tag}</span>
                    <span className={styles.date}>{item.date}</span>
                  </div>
                  <h2 className={styles.cardTitle}>{item.title}</h2>
                  <p className={styles.cardExcerpt}>{item.excerpt}</p>
                </div>
              </CardShell>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
