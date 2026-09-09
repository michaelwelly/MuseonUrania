import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import { newsHero, press } from "@/content/news";
import { companyContact } from "@/content/staff";
import { ui as strings } from "@/content/ui";
import { vedalina } from "@/content/vedalina";
import { fetchNews } from "@/lib/api";
import NewsFeed from "./feed";
import NewsSubscribe from "./subscribe";
import styles from "./page.module.css";

// Новости. Тело страницы вынесено из `page.tsx` в `screen.tsx`, потому что
// `screen.tsx` маршрутом не является: здесь можно держать любые экспорты
// и рисовать экран из тестов, чего `page.tsx` не позволяет.
//
// Заголовки и анонсы материалов пишет редактор в админке: пресс-релиз это
// утверждение компании, и экран его не сочиняет.

export function newsMetadata(): Metadata {
  return pageMetadata({
    title: strings.meta.news,
    description: newsHero.lead,
    path: "/news/",
  });
}

export default async function NewsScreen() {
  const news = await fetchNews();

  return (
    <main className={styles.page}>
      <PageHero
        crumbs={[{ label: strings.crumbs.home, href: "/" }, { label: strings.crumbs.news }]}
        title={newsHero.title}
        lead={newsHero.lead}
      />

      <NewsFeed news={news} />

      <section className={styles.press}>
        <div data-reveal="0">
          <p className={styles.eyebrow}>
            {press.eyebrow}
          </p>
          <h2 className={styles.h2} data-words="30">
            {press.title}
          </h2>
          {/* Абзац называет канал приёма запросов от СМИ и обещание компании —
              содержательный текст, а не подпись интерфейса. */}
          <p className={styles.pressText}>
            {press.text}
          </p>

          <div className={styles.contact}>
            <div className={styles.avatar}>
              <Image src={vedalina.avatar} alt="" width={40} height={40} />
            </div>
            <div>
              <p className={styles.contactName}>
                {companyContact.title}
              </p>
              <p className={styles.contactRole}>
                {companyContact.scope} ·{" "}
                <a href={`mailto:${companyContact.email}`}>{companyContact.email}</a>
              </p>
            </div>
          </div>
        </div>

        <NewsSubscribe />
      </section>
    </main>
  );
}
