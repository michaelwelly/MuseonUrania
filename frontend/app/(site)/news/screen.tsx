import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import BrandPattern from "@/components/BrandPattern";
import PageHero from "@/components/PageHero";
import { newsHero, press, pressMentions, pressMentionsBlock } from "@/content/news";
import { companyContact } from "@/content/staff";
import { ui as strings } from "@/content/ui";
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

      {/* Публикации в СМИ — чужие материалы со ссылкой на источник, поэтому
          отдельным списком, а не карточками ленты: у них нет своей страницы
          на сайте, и выглядеть собственной новостью они не должны.
          Ссылки уводят на сторонний сайт — открываются в новой вкладке,
          без передачи окна (noopener) и без адреса страницы (noreferrer). */}
      {pressMentions.length > 0 && (
        <section className={styles.mentions} aria-labelledby="press-mentions">
          <p className={styles.mentionsEyebrow} data-reveal="0">
            {pressMentionsBlock.eyebrow}
          </p>
          <h2 id="press-mentions" className={styles.mentionsTitle} data-words="30">
            {pressMentionsBlock.title}
          </h2>
          <ul className={styles.mentionsList}>
            {pressMentions.map((m, i) => (
              <li key={m.href} className={styles.mention} data-reveal={i}>
                <p className={styles.mentionMeta}>
                  <span className={styles.mentionOutlet}>{m.outlet}</span>
                  <time dateTime={m.isoDate}>{m.date}</time>
                </p>
                <a
                  className={styles.mentionLink}
                  href={m.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {m.title}
                  <span className={styles.mentionArrow} aria-hidden="true">
                    ↗
                  </span>
                  <span className={styles.srOnly}> (откроется в новой вкладке)</span>
                </a>
                <p className={styles.mentionNote}>{m.note}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

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
              <Image src="/brand/vedal-tree.png" alt="" width={512} height={512} />
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
