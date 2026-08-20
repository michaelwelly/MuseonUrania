import Image from "next/image";
import Link from "next/link";
import HomeLeadForm from "@/components/HomeLeadForm";
import LivePattern from "@/components/LivePattern";
import { site } from "@/content/site";
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

function Arrow({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export default function Home() {
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
          <p className={`${styles.eyebrow} ${styles.eyebrowLight}`} data-anim="rise-sm">
            {homeHero.eyebrow}
          </p>
          {/* Первый экран проявляется по словам: data-words — шаг между
              словами, data-wdelay — старт. Остальное поднимает CSS. */}
          <h1 className={styles.h1} data-words="34" data-wdelay="90">
            {homeHero.headline}
          </h1>
          <p className={styles.heroLead} data-words="13" data-wdelay="400">
            {homeHero.lead}
          </p>
          <div className={styles.heroActions} data-anim="cascade">
            <Link
              className={`${styles.btn} ${styles.btnPrimary}`}
              href={homeHero.primary.href}
              data-analytics="hero_quote_click"
            >
              {homeHero.primary.label}
              <Arrow />
            </Link>
            <Link
              className={`${styles.btn} ${styles.btnOutline}`}
              href={homeHero.secondary.href}
              data-analytics="hero_catalog_click"
            >
              {homeHero.secondary.label}
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
            <p className={`${styles.eyebrow} ${styles.eyebrowLight}`}>Каталог</p>
            <h2 className={styles.h2} data-words="30">
              Оборудование VEDAL
            </h2>
          </div>
          <Link className={styles.linkArrow} href="/products/">
            Весь каталог
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
          <p className={`${styles.eyebrow} ${styles.eyebrowLight}`}>{productionBlock.eyebrow}</p>
          <h2 className={styles.splitTitle} data-words="30">
            {productionBlock.title}
          </h2>
          <p className={styles.splitText}>{productionBlock.text}</p>
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
            {productionBlock.cta.label}
            <Arrow />
          </Link>
        </div>
      </section>

      {/* 06. Документы */}
      <section className={styles.docs}>
        <div data-reveal="0">
          <p className={`${styles.eyebrow} ${styles.eyebrowLight}`}>{documentsBlock.eyebrow}</p>
          <h2 className={styles.docsTitle} data-words="30">
            {documentsBlock.title}
          </h2>
          <p className={styles.docsText}>{documentsBlock.text}</p>
          <Link
            className={`${styles.btn} ${styles.btnDark} ${styles.docsCta}`}
            href={documentsBlock.cta.href}
          >
            {documentsBlock.cta.label}
            <Arrow />
          </Link>
        </div>

        <div className={styles.table} data-reveal="1">
          <div className={styles.tableHead}>
            <span>Документ</span>
            <span>Тип</span>
            <span>Доступ</span>
          </div>
          {documentsBlock.rows.map((row) => (
            <div key={row.name} className={styles.tableRow}>
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
            Новости
          </h2>
          <Link className={styles.linkArrow} href="/news/">
            Все новости
            <Arrow />
          </Link>
        </div>

        {news.length === 0 ? (
          <p className={styles.newsEmpty}>
            Публикаций пока нет. Первым материалом планируется релиз по Иннопрому — раздел
            наполнится, когда компания передаст тексты и разрешённые к публикации фотографии.
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
      {/* Тёмная полоса — единственное место на главной, где паттерну есть
          куда лечь: остальные полосы заняты фото и карточками во всю ширину.
          Без квадратов и на 9%: насыщенный зелёный на почти чёрном тянул бы
          взгляд сильнее заголовка. */}
      <section className={`${styles.cta} patternHost`}>
        <LivePattern variant={1} tone="dark" />
        <div data-reveal="0">
          <h2 className={styles.ctaTitle} data-words="30">
            {homeCta.title}
          </h2>
          <p className={styles.ctaText}>{homeCta.text}</p>
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
