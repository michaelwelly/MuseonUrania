import type { Metadata } from "next";
import { site } from "@/content/site";
import { newsHero, news, expected, newsNotice } from "@/content/news";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Новости — VEDAL",
  description: newsHero.lead,
};

export default function NewsPage() {
  return (
    <main className={styles.page}>
      <section className={styles.section}>
        <p className={styles.eyebrow}>{newsHero.eyebrow}</p>
        <h1 className={styles.h1}>{newsHero.headline}</h1>
        <p className={styles.lead}>{newsHero.lead}</p>
      </section>

      <section className={styles.section}>
        {news.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Публикаций пока нет</p>
            <p className={styles.emptyText}>
              Раздел готов к наполнению. Первым материалом планируется релиз по
              Иннопрому — ждём исходники от компании.
            </p>
            <ul className={styles.expected}>
              {expected.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className={styles.list}>
            {news.map((item) => (
              <li key={item.title} className={styles.item}>
                <p className={styles.date}>{item.date}</p>
                <h2 className={styles.itemTitle}>{item.title}</h2>
                <p className={styles.excerpt}>{item.excerpt}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{newsNotice.title}</h2>
        <p className={styles.note}>{newsNotice.text}</p>
        <address className={styles.contacts}>
          <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>
          <a href={`mailto:${site.email}`}>{site.email}</a>
        </address>
      </section>
    </main>
  );
}
