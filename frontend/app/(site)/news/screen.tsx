import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import TranslationNotice from "@/components/TranslationNotice";
import { newsHero, press } from "@/content/news";
import { companyContact, STAFF_AWAITING } from "@/content/staff";
import { ui } from "@/content/ui";
import { vedalina } from "@/content/vedalina";
import { fetchNews } from "@/lib/api";
import { contentText } from "@/lib/content-i18n";
import { localePath, type Lang } from "@/lib/i18n";
import NewsFeed from "./feed";
import NewsSubscribe from "./subscribe";
import styles from "./page.module.css";

// Новости. Тело страницы вынесено из `page.tsx` в `screen.tsx`, потому что
// его рисуют два маршрута: `/news/` (русский, `app/(site)`) и `/[lang]/news/`
// (переведённый, `app/(intl)`). Файл `screen.tsx` маршрутом не является,
// поэтому здесь можно держать любые экспорты.
//
// Заголовки и анонсы материалов пишет редактор в админке — переводит их
// заказчик, а не мы: пресс-релиз это утверждение компании.

export function newsMetadata(lang: Lang): Metadata {
  const strings = ui(lang);
  const c = contentText(lang);
  return pageMetadata({
    title: strings.meta.news,
    description: c.t(newsHero.lead),
    path: "/news/",
    lang,
  });
}

export default async function NewsScreen({ lang }: { lang: Lang }) {
  const news = await fetchNews();
  const strings = ui(lang);
  const c = contentText(lang);
  const at = (path: string) => localePath(lang, path);

  return (
    <main className={styles.page}>
      <PageHero
        crumbs={[{ label: strings.crumbs.home, href: at("/") }, { label: strings.crumbs.news }]}
        title={c.t(newsHero.title)}
        lead={c.t(newsHero.lead)}
        textLang={c.mark(newsHero.title, newsHero.lead)}
      />

      {/* Примечание о непереведённом стоит сразу после первого экрана:
          ниже идут заголовки и анонсы материалов, перевод которых
          согласовывает заказчик. Для русской версии не рисуется. */}
      <TranslationNotice lang={lang} />

      <NewsFeed news={news} lang={lang} />

      <section className={styles.press}>
        <div data-reveal="0">
          <p className={styles.eyebrow} lang={c.mark(press.eyebrow)}>
            {c.t(press.eyebrow)}
          </p>
          <h2 className={styles.h2} data-words="30" lang={c.mark(press.title)}>
            {c.t(press.title)}
          </h2>
          {/* Абзац называет канал приёма запросов от СМИ и обещание компании —
              содержательный текст, а не подпись интерфейса. */}
          <p className={styles.pressText} lang={c.mark(press.text)}>
            {c.t(press.text)}
          </p>

          <div className={styles.contact}>
            <div className={styles.avatar}>
              <Image src={vedalina.avatar} alt="" width={40} height={40} />
            </div>
            <div>
              <p className={styles.contactName} lang={c.mark(companyContact.title)}>
                {c.t(companyContact.title)}
              </p>
              <p className={styles.contactRole} lang={c.mark(companyContact.scope)}>
                {c.t(companyContact.scope)} ·{" "}
                <a href={`mailto:${companyContact.email}`}>{companyContact.email}</a>
              </p>
            </div>
          </div>
          {/* Пресс-контакт — заглушка из макета, см. content/staff.ts */}
          <p className={styles.demoNote} lang={c.mark(STAFF_AWAITING)}>
            {c.t(STAFF_AWAITING)}
          </p>
        </div>

        <NewsSubscribe lang={lang} />
      </section>
    </main>
  );
}
