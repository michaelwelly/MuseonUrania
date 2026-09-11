import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import BrandPattern from "@/components/BrandPattern";
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
        currentPath="/news/"
        pattern={181}
      />

      <NewsFeed news={news} />

      {/* Тёмная полоса «для СМИ» — единственный крупный однотонный блок
          на этой странице: выше идёт лента карточек, узор в ней спорил бы
          с обложками новостей.

          Зоны две, по колонкам. Левая — текст и подпись (до 673 по ширине
          и до 320 по высоте в координатах поля 1400 × 380), правая — форма
          подписки (от 728 до 1354, до 276). Свободными остаются полоса
          сверху, полоса снизу и промежуток между колонками — туда и встают
          акценты; бледные формы обе зоны пропускают. */}
      <section className={`${styles.press} patternHost`}>
        <div className={styles.pressPattern}>
          <BrandPattern
            seed={193}
            boldness={3}
            width={1400}
            height={380}
            tone="dark"
            keepClear={[
              { x2: 700, y1: 50, y2: 335 },
              { x1: 715, x2: 1370, y1: 50, y2: 290 },
            ]}
          />
        </div>
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
