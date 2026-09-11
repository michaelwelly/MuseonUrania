import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import HomeLeadForm from "@/components/HomeLeadForm";
import BrandPattern from "@/components/BrandPattern";
import { site } from "@/content/site";
import { ui as strings } from "@/content/ui";
import { news } from "@/content/news";
import {
  homeHero,
  featured,
  productionBlock,
  documentsBlock,
  homeCta,
} from "@/content/home";
import styles from "./page.module.css";
import { mediaSrc } from "@/lib/media";
import { pageMetadata } from "@/lib/seo";

// Главная. Тело страницы вынесено из `page.tsx` в `screen.tsx`, потому что
// `screen.tsx` маршрутом не является — Next знает только `page`, `layout`,
// `route` и ещё несколько имён. Здесь можно держать любые экспорты и рисовать
// экран из тестов, чего `page.tsx` не позволяет.
//
// Подписи интерфейса берутся из `content/ui.ts`, содержательный текст —
// из `content/home.ts`: то, что утверждает об изделии или о компании,
// правит заказчик.

export function homeMetadata(): Metadata {
  return pageMetadata({
    title: strings.meta.siteTitle,
    description: strings.meta.siteDescription,
    path: "/",
  });
}

function Arrow({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export default function HomeScreen() {
  return (
    <main className={styles.page}>
      {/* 01. Hero */}
      {/* Узор стоит фоном текстовой половины, а не полосой в стыке.

          Полосой он тут не помещался: справа фотография во всю высоту,
          и на композицию оставалось 244 пикселя при нужных 465 — она
          наезжала на строки. Полем за текстом места хватает, а коридор
          в раскладке держит заголовок, лид и кнопки чистыми: фигура,
          попавшая в их прямоугольник, не рисуется вовсе.

          Зерно у каждого места сайта своё — иначе два поля на одной
          странице показали бы один и тот же рисунок дважды. */}
      <section className={styles.hero}>
        <div className={styles.heroPattern}>
          <BrandPattern
            seed={0}
            boldness={3.2}
            width={830}
            height={648}
            keepClear={[
              // Шапка прозрачна во всю ширину — без этой полосы узор
              // просвечивает сквозь неё и садится на логотип.
              { x2: 830, y1: 0, y2: 92, strict: true },
              // Заголовок, лид и кнопки.
              { x2: 600, y1: 104, y2: 580 },
            ]}
          />
        </div>
        <div className={styles.heroCopy}>
          {/* data-anim — крючки появления первого экрана, правила в app/motion.css */}
          <p
            className={`${styles.eyebrow} ${styles.eyebrowLight}`}
            data-anim="rise-sm"
          >
            {homeHero.eyebrow}
          </p>
          {/* Первый экран проявляется по словам: data-words — шаг между
              словами, data-wdelay — старт. Остальное поднимает CSS. */}
          <h1
            className={styles.h1}
            data-words="34"
            data-wdelay="90"
          >
            {homeHero.headline}
          </h1>
          <p
            className={styles.heroLead}
            data-words="13"
            data-wdelay="400"
          >
            {homeHero.lead}
          </p>
          <div className={styles.heroActions} data-anim="cascade">
            {/* Обычный `<a>`: это якорь на форму внизу этой же страницы
                (issue #103). `Link` менял бы адрес своим `pushState`
                и не порождал бы hashchange — см. components/Blocks.tsx. */}
            <a
              className={`${styles.btn} ${styles.btnPrimary}`}
              href={homeHero.primary.href}
              data-analytics="hero_quote_click"
            >
              {strings.actions.requestQuote}
              <Arrow />
            </a>
            <Link
              className={`${styles.btn} ${styles.btnOutline}`}
              href={homeHero.secondary.href}
              data-analytics="hero_catalog_click"
            >
              {strings.actions.equipmentCatalogue}
            </Link>
          </div>
        </div>

        <div className={styles.heroVisual} data-anim="clip ken">
          <Image
            src={mediaSrc(homeHero.image.src)}
            alt={homeHero.image.alt}
            fill
            sizes="(max-width: 1100px) 100vw, 588px"
            priority
          />
        </div>
      </section>

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
          <Link className={styles.linkArrow} href="/products/">
            {strings.actions.fullCatalogue}
            <Arrow />
          </Link>
        </div>

        <ul className={styles.cards}>
          {featured.map((p, i) => (
            <li key={p.slug} data-reveal={i}>
              <Link
                className={styles.card}
                href={`/products/${p.slug}/`}
                data-analytics="product_card_open"
              >
                <div className={styles.cardPhoto}>
                  <Image
                    src={mediaSrc(p.image.src)}
                    alt={p.image.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 25vw"
                  />
                </div>
                <div className={styles.cardBody}>
                  <p className={styles.cardCat}>{p.category}</p>
                  <h3 className={styles.cardName}>{p.name}</h3>
                  <p className={styles.cardText}>{p.text}</p>
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
            alt={productionBlock.image.alt}
            fill
            sizes="(max-width: 1100px) 100vw, 50vw"
          />
        </div>
        <div className={styles.splitCopy} data-reveal="1">
          <p className={`${styles.eyebrow} ${styles.eyebrowLight}`}>
            {productionBlock.eyebrow}
          </p>
          <h2 className={styles.splitTitle} data-words="30">
            {productionBlock.title}
          </h2>
          <p className={styles.splitText}>
            {productionBlock.text}
          </p>
          <ul className={styles.facts}>
            {productionBlock.facts.map((f) => (
              <li key={f.label} className={styles.fact}>
                <span>{f.label}</span>
                <span className={styles.factValue}>{f.value}</span>
              </li>
            ))}
          </ul>
          {/* Тёмная кнопка, а не призрачная: на светлом фоне белая рамка
              с белым текстом не видна вовсе. Та же пара, что у блока
              документов ниже, — соседние светлые полосы держат один приём. */}
          <Link
            className={`${styles.btn} ${styles.btnDark} ${styles.ghostWide}`}
            href={productionBlock.cta.href}
          >
            {strings.actions.seeProduction}
            <Arrow />
          </Link>
        </div>
      </section>

      {/* 06. Документы */}
      <section className={styles.docs}>
        <div data-reveal="0">
          <p className={`${styles.eyebrow} ${styles.eyebrowLight}`}>
            {documentsBlock.eyebrow}
          </p>
          <h2 className={styles.docsTitle} data-words="30">
            {documentsBlock.title}
          </h2>
          <p className={styles.docsText}>
            {documentsBlock.text}
          </p>
          <Link
            className={`${styles.btn} ${styles.btnDark} ${styles.docsCta}`}
            href={documentsBlock.cta.href}
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
            <div
              key={row.name}
              className={styles.tableRow}
            >
              <span>{row.name}</span>
              <span className={styles.tableType}>{row.type}</span>
              <span
                className={`${styles.badge} ${
                  row.access === "Уточняется" ? styles.badgeMuted : styles.badgeOk
                }`}
              >
                {row.access}
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
          <Link className={styles.linkArrow} href="/news/">
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
            <span>{HOME_NEWS_PLAN}</span>
          </p>
        ) : (
          <ul className={styles.newsGrid}>
            {news.slice(0, 3).map((item, i) => (
              <li key={item.title} data-reveal={i}>
                <Link className={styles.card} href="/news/">
                  <div className={styles.newsPhoto} />
                  <div className={styles.newsBody}>
                    <span className={styles.newsDate}>{item.date}</span>
                    <h3 className={styles.newsTitle}>{item.title}</h3>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 08. CTA + форма */}
      {/* На тёмной полосе тот же узор в другой краске: светлые формы
          уходят в белый на 7 и 13 процентов, акцент, наоборот, светлеет —
          фирменный зелёный на почти чёрном сливается с фоном. */}
      {/* id — цель кнопки «Запросить КП» с первого экрана (issue #103).
          Стоит на секции, а не на самой форме: человека надо привести
          к заголовку «Подберём конфигурацию», а не к первому полю. */}
      <section className={`${styles.cta} patternHost`} id="quote">
        <div className={styles.ctaPattern}>
          {/* Зоны держат яркие кубики вне заголовка с абзацем и вне формы:
              без них квадрат садился на поля ввода и на подпись под кнопкой.
              Бледные формы в зоны заходить могут — это фон, читать не мешает.

              Числа — в координатах поля 1400 × 520, а не в пикселях: поле
              кроится по большей стороне, и одна и та же точка экрана на
              разных ширинах попадает в разные точки рисунка. Замерено
              на 1280, 1440 и 1920; зона — объединение трёх замеров с запасом:
                текст  x 35…678,   y 142…378
                форма  x 722…1365, y 65…455
              Уже 1100 полоса встаёт в одну колонку, и эти зоны мимо —
              там кубики скрыты стилем (.ctaPattern в page.module.css).

              Ещё две полосы слева — сверху и снизу за пределами y 62…458.
              На широком экране (1920) поле срезается по высоте, и видна
              только эта середина: кубик у самого края показывался огрызком
              в полфигуры. Слева он теперь встаёт между телефоном и краем
              целиком. Справа, над формой и под ней, кубикам просто нельзя
              заходить за край поля: большой квадрат вытесняло из-за формы
              наверх, и он висел на кромке полосы половиной. Теперь он
              уменьшается и встаёт в просвет целиком; на 1920 эти просветы
              за кадром полностью, огрызков нет и там. */}
          <BrandPattern
            seed={17}
            width={1400}
            height={520}
            boldness={3}
            tone="dark"
            keepClear={[
              { x2: 690, y1: 130, y2: 390 },
              { x1: 710, x2: 1400, y1: 55, y2: 467 },
              { x2: 690, y1: -200, y2: 62 },
              { x2: 690, y1: 458, y2: 800 },
              { x1: 710, x2: 1400, y1: -200, y2: 0 },
              { x1: 710, x2: 1400, y1: 520, y2: 800 },
            ]}
          />
        </div>
        <div data-reveal="0">
          <h2 className={styles.ctaTitle} data-words="30">
            {homeCta.title}
          </h2>
          <p className={styles.ctaText}>
            {homeCta.text}
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
        <HomeLeadForm />
      </section>
    </main>
  );
}

// Планы по наполнению новостей: называет Иннопром и обещание передать
// материалы. Утверждение компании, значит — содержательный текст.
const HOME_NEWS_PLAN =
  "Первым материалом планируется релиз по Иннопрому — раздел наполнится, когда компания передаст тексты и разрешённые к публикации фотографии.";
