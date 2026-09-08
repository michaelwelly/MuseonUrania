import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import HomeLeadForm from "@/components/HomeLeadForm";
import LivePattern from "@/components/LivePattern";
import TranslationNotice from "@/components/TranslationNotice";
import { site } from "@/content/site";
import { ui } from "@/content/ui";
import { news } from "@/content/news";
import {
  homeHero,
  featured,
  productionBlock,
  documentsBlock,
  homeCta,
} from "@/content/home";
import styles from "./page.module.css";
import { contentText } from "@/lib/content-i18n";
import { localePath, type Lang } from "@/lib/i18n";
import { mediaSrc } from "@/lib/media";
import { pageMetadata } from "@/lib/seo";

// Главная. Тело страницы вынесено из `page.tsx` в `screen.tsx`, потому что
// его рисуют два маршрута: `/` (русский, `app/(site)`) и `/[lang]/`
// (переведённый, `app/(intl)`). Файл `screen.tsx` маршрутом не является —
// Next знает только `page`, `layout`, `route` и ещё несколько имён, —
// поэтому здесь можно держать любые экспорты, чего `page.tsx` не позволяет.
//
// Язык приходит пропом. Интерфейс берётся из `content/ui.ts`, содержательный
// текст — через `contentText`: перевод, если он согласован, иначе русский
// оригинал с пометкой `lang="ru"`.

export function homeMetadata(lang: Lang): Metadata {
  const strings = ui(lang);
  return pageMetadata({
    title: strings.meta.siteTitle,
    description: strings.meta.siteDescription,
    path: "/",
    lang,
  });
}

function Arrow({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export default function HomeScreen({ lang }: { lang: Lang }) {
  const strings = ui(lang);
  const c = contentText(lang);
  const at = (path: string) => localePath(lang, path);

  return (
    <main className={styles.page}>
      {/* 01. Hero */}
      {/* Живого паттерна на этом первом экране нет намеренно. Правая
          половина полосы — фото во всю высоту, и композиция уходила бы
          под него на 62%, а видимой частью наезжала на текст: между
          концом строки и краем фото всего 244 пикселя, а паттерну нужно
          465. Паттерн стоит там, где для него есть место, — на первых
          экранах внутренних страниц и на тёмной полосе призыва ниже. */}
      <section className={`${styles.hero} patternHost`}>
        <LivePattern variant={2} placement="seam" />
        <div className={styles.heroCopy}>
          {/* data-anim — крючки появления первого экрана, правила в app/motion.css */}
          <p
            className={`${styles.eyebrow} ${styles.eyebrowLight}`}
            data-anim="rise-sm"
            lang={c.mark(homeHero.eyebrow)}
          >
            {c.t(homeHero.eyebrow)}
          </p>
          {/* Первый экран проявляется по словам: data-words — шаг между
              словами, data-wdelay — старт. Остальное поднимает CSS. */}
          <h1
            className={styles.h1}
            data-words="34"
            data-wdelay="90"
            lang={c.mark(homeHero.headline)}
          >
            {c.t(homeHero.headline)}
          </h1>
          <p
            className={styles.heroLead}
            data-words="13"
            data-wdelay="400"
            lang={c.mark(homeHero.lead)}
          >
            {c.t(homeHero.lead)}
          </p>
          <div className={styles.heroActions} data-anim="cascade">
            <Link
              className={`${styles.btn} ${styles.btnPrimary}`}
              href={at(homeHero.primary.href)}
              data-analytics="hero_quote_click"
            >
              {strings.actions.requestQuote}
              <Arrow />
            </Link>
            <Link
              className={`${styles.btn} ${styles.btnOutline}`}
              href={at(homeHero.secondary.href)}
              data-analytics="hero_catalog_click"
            >
              {strings.actions.equipmentCatalogue}
            </Link>
          </div>
        </div>

        <div className={styles.heroVisual} data-anim="clip ken">
          <Image
            src={mediaSrc(homeHero.image.src)}
            alt={c.t(homeHero.image.alt)}
            fill
            sizes="(max-width: 1100px) 100vw, 588px"
            priority
          />
        </div>
      </section>

      {/* Примечание о непереведённом стоит сразу после первого экрана:
          дальше начинаются описания изделий и статусы документов, а их
          перевод согласовывает заказчик. Для русской версии не рисуется. */}
      <TranslationNotice lang={lang} />

      {/* Полоса цифр и блок «Направления» убраны с главной 19 августа по
          прямому решению заказчика. Те же два блока §2.1 и §2.4 сняли
          со страницы «О компании» — на главной они уцелели и повторяли
          ровно то, от чего заказчик отказался.

          Обе полосы к тому же обещали больше, чем есть: «5 направлений»
          при четырёх изделиях в трёх направлениях, а карточки
          «Анестезиология» и «Мониторинг» вели в каталог, где изделий
          этих направлений нет. По той же причине 19 августа с каталога
          сняли фильтр по направлениям.

          Из первого экрана сразу идёт каталог. */}

      {/* 02. Каталог */}
      <section className={styles.sectionSoft}>
        <div className={`${styles.sectionHead} ${styles.sectionHeadSplit}`} data-reveal="0">
          <div>
            <p className={`${styles.eyebrow} ${styles.eyebrowLight}`}>
              {strings.home.catalogueEyebrow}
            </p>
            <h2 className={styles.h2} data-words="30">
              {strings.home.catalogueTitle}
            </h2>
          </div>
          <Link className={styles.linkArrow} href={at("/products/")}>
            {strings.actions.fullCatalogue}
            <Arrow />
          </Link>
        </div>

        <ul className={styles.cards}>
          {featured.map((p, i) => (
            <li key={p.slug} data-reveal={i}>
              <Link
                className={styles.card}
                href={at(`/products/${p.slug}/`)}
                data-analytics="product_card_open"
              >
                <div className={styles.cardPhoto}>
                  <Image
                    src={mediaSrc(p.image.src)}
                    alt={c.t(p.image.alt)}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 25vw"
                  />
                </div>
                {/* Название изделия, направление и краткое описание —
                    содержательный текст. Помечаем весь блок разом: если
                    хоть одна строка осталась оригиналом, блок русский. */}
                <div className={styles.cardBody} lang={c.mark(p.category, p.text)}>
                  <p className={styles.cardCat}>{c.t(p.category)}</p>
                  <h3 className={styles.cardName}>{p.name}</h3>
                  <p className={styles.cardText}>{c.t(p.text)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 05. Производство */}
      <section className={styles.split}>
        <div className={styles.splitPhoto} data-reveal="0">
          <Image
            src={mediaSrc(productionBlock.image.src)}
            alt={c.t(productionBlock.image.alt)}
            fill
            sizes="(max-width: 1100px) 100vw, 50vw"
          />
        </div>
        <div className={styles.splitCopy} data-reveal="1">
          <p
            className={`${styles.eyebrow} ${styles.eyebrowLight}`}
            lang={c.mark(productionBlock.eyebrow)}
          >
            {c.t(productionBlock.eyebrow)}
          </p>
          <h2 className={styles.splitTitle} data-words="30" lang={c.mark(productionBlock.title)}>
            {c.t(productionBlock.title)}
          </h2>
          <p className={styles.splitText} lang={c.mark(productionBlock.text)}>
            {c.t(productionBlock.text)}
          </p>
          <ul className={styles.facts}>
            {productionBlock.facts.map((f) => (
              <li key={f.label} className={styles.fact} lang={c.mark(f.label, f.value)}>
                <span>{c.t(f.label)}</span>
                <span className={styles.factValue}>{c.t(f.value)}</span>
              </li>
            ))}
          </ul>
          {/* Тёмная кнопка, а не призрачная: на светлом фоне белая рамка
              с белым текстом не видна вовсе. Та же пара, что у блока
              документов ниже, — соседние светлые полосы держат один приём. */}
          <Link
            className={`${styles.btn} ${styles.btnDark} ${styles.ghostWide}`}
            href={at(productionBlock.cta.href)}
          >
            {strings.actions.seeProduction}
            <Arrow />
          </Link>
        </div>
      </section>

      {/* 06. Документы */}
      <section className={styles.docs}>
        <div data-reveal="0">
          <p
            className={`${styles.eyebrow} ${styles.eyebrowLight}`}
            lang={c.mark(documentsBlock.eyebrow)}
          >
            {c.t(documentsBlock.eyebrow)}
          </p>
          <h2 className={styles.docsTitle} data-words="30" lang={c.mark(documentsBlock.title)}>
            {c.t(documentsBlock.title)}
          </h2>
          <p className={styles.docsText} lang={c.mark(documentsBlock.text)}>
            {c.t(documentsBlock.text)}
          </p>
          <Link
            className={`${styles.btn} ${styles.btnDark} ${styles.docsCta}`}
            href={at(documentsBlock.cta.href)}
          >
            {strings.actions.allDocuments}
            <Arrow />
          </Link>
        </div>

        <div className={styles.table} data-reveal="1">
          <div className={styles.tableHead}>
            <span>{strings.home.docHeadName}</span>
            <span>{strings.home.docHeadType}</span>
            <span>{strings.home.docHeadAccess}</span>
          </div>
          {documentsBlock.rows.map((row) => (
            // Названия документов, их тип и способ получения — утверждения
            // о разрешительных документах. Ровно тот случай, где машинный
            // перевод запрещён правилами контента.
            <div
              key={row.name}
              className={styles.tableRow}
              lang={c.mark(row.name, row.type, row.access)}
            >
              <span>{c.t(row.name)}</span>
              <span className={styles.tableType}>{c.t(row.type)}</span>
              <span
                className={`${styles.badge} ${
                  row.access === "Уточняется" ? styles.badgeMuted : styles.badgeOk
                }`}
              >
                {c.t(row.access)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 07. Новости */}
      <section className={styles.sectionSoft}>
        <div className={styles.newsHead} data-reveal="0">
          <h2 className={`${styles.h2} ${styles.h2News}`} data-words="34">
            {strings.home.newsTitle}
          </h2>
          <Link className={styles.linkArrow} href={at("/news/")}>
            {strings.actions.allNews}
            <Arrow />
          </Link>
        </div>

        {news.length === 0 ? (
          <p className={styles.newsEmpty}>
            {strings.home.noPublications}
            {". "}
            {/* Вторая фраза называет конкретное событие и обещание компании —
                это содержательный текст, а не состояние интерфейса. */}
            <span lang={c.mark(HOME_NEWS_PLAN)}>{c.t(HOME_NEWS_PLAN)}</span>
          </p>
        ) : (
          <ul className={styles.newsGrid}>
            {news.slice(0, 3).map((item, i) => (
              <li key={item.title} data-reveal={i}>
                <Link className={styles.card} href={at("/news/")}>
                  <div className={styles.newsPhoto} />
                  <div className={styles.newsBody} lang={c.mark(item.title)}>
                    <span className={styles.newsDate}>{item.date}</span>
                    <h3 className={styles.newsTitle}>{c.t(item.title)}</h3>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 08. CTA + форма */}
      {/* Тёмная полоса — единственное место на главной, где паттерну есть
          куда лечь: остальные полосы заняты фото и карточками во всю ширину.
          Без квадратов и на 9%: насыщенный зелёный на почти чёрном тянул бы
          взгляд сильнее заголовка. */}
      <section className={`${styles.cta} patternHost`}>
        <LivePattern variant={1} tone="dark" />
        <div data-reveal="0">
          <h2 className={styles.ctaTitle} data-words="30" lang={c.mark(homeCta.title)}>
            {c.t(homeCta.title)}
          </h2>
          <p className={styles.ctaText} lang={c.mark(homeCta.text)}>
            {c.t(homeCta.text)}
          </p>
          <address className={styles.ctaContacts}>
            <a className={styles.ctaPhone} href={`tel:${site.phone.replace(/\s/g, "")}`}>
              {site.phone}
            </a>
            <a className={styles.ctaMail} href={`mailto:${site.email}`}>
              {site.email}
            </a>
          </address>
        </div>

        {/* Форма — отдельный клиентский компонент, страница остаётся серверной. */}
        <HomeLeadForm lang={lang} />
      </section>
    </main>
  );
}

// Планы по наполнению новостей: называет Иннопром и обещание передать
// материалы. Утверждение компании, значит — содержательный текст.
const HOME_NEWS_PLAN =
  "Первым материалом планируется релиз по Иннопрому — раздел наполнится, когда компания передаст тексты и разрешённые к публикации фотографии.";
