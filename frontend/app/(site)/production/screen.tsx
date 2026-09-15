import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import VedalMap from "@/components/VedalMap";
import VedalMapEmbed from "@/components/VedalMapEmbed";
import { site } from "@/content/site";
import { productionHero, facility, productionMedia, address } from "@/content/production";
import { ui as strings } from "@/content/ui";
import TreeMark from "@/components/TreeMark";
import BrandPattern from "@/components/BrandPattern";
import LivePattern from "@/components/LivePattern";
import styles from "./page.module.css";
import { mediaSrc } from "@/lib/media";
import { JsonLd, breadcrumbStructuredData } from "@/lib/structured-data";

// «Производство». Тело вынесено из `page.tsx` в `screen.tsx`, потому что
// `screen.tsx` маршрутом не является: здесь можно держать любые экспорты
// и рисовать экран из тестов, чего `page.tsx` не позволяет.
//
// Тексты страницы описывают площадку — это утверждения о компании, и правит
// их заказчик. Через словарь интерфейса идут только крошки и кнопки.

export function productionMetadata(): Metadata {
  return pageMetadata({
    title: strings.meta.production,
    description: productionHero.lead,
    path: "/production/",
  });
}

export default function ProductionScreen() {
  return (
    <main className={styles.page}>
      <JsonLd
        id="breadcrumb-jsonld-production"
        data={breadcrumbStructuredData(
          [{ label: strings.crumbs.home, href: "/" }, { label: strings.crumbs.production }],
          "/production/",
        )}
      />
      {/* Узор стоит полем за текстом, а не полосой в стыке: правую половину
          занимает фотография во всю высоту, и на полосу оставалось бы
          слишком мало, чтобы композиция читалась.

          Зона снята замером на ширине 1440. В координатах поля (820 × 520)
          заголовок кончается на 577, лид на 350, кнопка «Схема проезда»
          на 449 — коридор закрывает все три и на двадцать пикселей шире
          самой длинной строки. Шире делать нельзя: на 620 мелкий акцент
          оказывался заперт между коридором и крупной веткой справа
          и не находил места вовсе — в поле выходило шестнадцать форм
          вместо семнадцати. */}
      <section className={`${styles.hero} patternHost`}>
        <LivePattern variant={1} placement="seam" />
        <div className={styles.heroPattern}>
          <BrandPattern
            seed={239}
            boldness={3}
            width={820}
            height={520}
            keepClear={[{ x2: 600, y1: 85, y2: 465 }]}
          />
        </div>
        <div className={styles.heroCopy}>
          <p className={styles.crumbs}>
            <Link href="/">{strings.crumbs.home}</Link> / {strings.crumbs.production}
          </p>
          <h1
            className={styles.h1}
            data-words="34"
            data-wdelay="110"
          >
            {productionHero.title}
          </h1>
          <p
            className={styles.lead}
            data-words="13"
            data-wdelay="400"
          >
            {productionHero.lead}
          </p>
          {/* «Записаться на визит» убрано по §6.1 плана: приём посетителей
              никто не подтверждал, а кнопка его обещала. */}
          <div className={styles.heroActions} data-anim="cascade">
            <a className={`${styles.btn} ${styles.btnGhost}`} href="#map">
              {strings.actions.howToGet}
            </a>
          </div>
        </div>
        <div className={styles.photo} data-anim="clip ken">
          <Image
            src={mediaSrc(productionHero.image.src)}
            alt={productionHero.image.alt}
            fill
            quality={90}
            sizes="(max-width: 1100px) 100vw, 50vw"
            priority
          />
        </div>
      </section>

      <section className={styles.facility}>
        <div data-reveal="0">
          <p className={styles.eyebrow}>
            {facility.eyebrow}
          </p>
          <h2 className={styles.h2} data-words="30">
            {facility.title}
          </h2>
        </div>
        <div data-reveal="1">
          {facility.paragraphs.map((p) => (
            <p key={p} className={styles.paragraph}>
              {p}
            </p>
          ))}
          {/* §11.2: место маркировочного знака. Рисуется, когда заказчик
              передаст файл — см. content/brand.ts. */}
          <TreeMark where="production" />
        </div>
      </section>

      {/* Плеер и фотоархив — решение заказчика 15 сентября, подробности
          в content/production.ts. Обе ячейки рисуются по данным: вписали
          путь к ролику — вместо постера встаёт плеер, вписали ссылку —
          плитка становится ссылкой. */}
      <ul className={styles.gallery}>
        <li data-reveal="0">
          <div className={styles.shot}>
            {productionMedia.video.src ? (
              /* preload="none": ролик не тянется у каждого, кто открыл
                 страницу, — только у того, кто нажал «play». */
              <video
                src={mediaSrc(productionMedia.video.src)}
                poster={mediaSrc(productionMedia.video.poster)}
                controls
                playsInline
                preload="none"
                aria-label={productionMedia.video.title}
              />
            ) : (
              /* Ролика нет — только постер. Ни кнопки «play», ни «скоро»:
                 кнопка, которая ничего не запускает, обещает то, чего нет. */
              <Image
                src={mediaSrc(productionMedia.video.poster)}
                alt={productionMedia.video.title}
                fill
                quality={90}
                /* Ячейка занимает две колонки из трёх (сетка 2fr 1fr) —
                   ей нужна подсказка 67vw. С 33vw браузер тянул файл
                   в полтора раза уже ячейки, и кадр на мониторе выходил
                   мыльным. На телефоне сетка в одну колонку. */
                sizes="(max-width: 640px) 100vw, 67vw"
              />
            )}
          </div>
        </li>
        <li data-reveal="1">
          {productionMedia.archive.href ? (
            /* Архив — своя страница сайта (/production/archive/), поэтому
               обычный переход в той же вкладке. */
            <Link
              className={`${styles.shot} ${styles.archive} ${styles.archiveLink}`}
              href={productionMedia.archive.href}
            >
              <ArchiveTile linked />
            </Link>
          ) : (
            <div className={`${styles.shot} ${styles.archive}`}>
              <ArchiveTile linked={false} />
            </div>
          )}
        </li>
      </ul>

      <section className={styles.address} id="map">
        <div className={styles.addressCopy} data-reveal="0">
          <p className={styles.eyebrow}>
            {address.eyebrow}
          </p>
          <h2 className={styles.addressTitle} data-words="30">
            {address.title}
          </h2>
          <address className={styles.addressLines}>
            {address.lines.map((line) => (
              <span key={line}>
                {line}
              </span>
            ))}
            <span>
              {/* Часы берутся оттуда же, откуда их берёт шапка
                  (`content/ui.ts` → `header.hours` → `content/site.ts`):
                  второй источник разошёлся бы с первым молча, а часы уже
                  правились однажды — issue #76. */}
              {strings.header.hours} ·{" "}
              <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>
            </span>
          </address>
          {/* Кнопка строит маршрут, а не уводит на общие контакты: раньше
              она вела на /contacts/, и человек искал там ту же кнопку заново
              (issue #102). Адрес тот же, что у кнопки на контактах, —
              собран из подтверждённого site.address, см. lib/maps.ts.

              Внешний адрес, поэтому обычный `<a>` и новая вкладка:
              `Link` для чужого домена не нужен, а `rel="noopener"` обязателен —
              без него открытая вкладка получает доступ к `window.opener`. */}
          <a
            className={`${styles.btn} ${styles.btnOutline} ${styles.addressCta}`}
            href={address.routeHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            {strings.actions.getDirections}
          </a>
        </div>
        <div className={styles.mapSlot} data-reveal="1">
          {/* Та же карта, что на контактах, и по той же причине: страница
              «Производство» заканчивается адресом площадки, и нарисованная
              схема на его месте отвечает на вопрос «как выглядит район»,
              а не «как сюда доехать».

              Кадр поднимается только после согласия в плашке про cookie —
              вместе с ним данные о визите уходят в Яндекс. Без согласия
              остаётся прежняя схема на CSS, а адрес и кнопка маршрута
              стоят в панели слева и работают всегда. */}
          <VedalMapEmbed src={address.mapSrc} title={address.mapTitle}>
            <VedalMap />
          </VedalMapEmbed>
        </div>
      </section>
    </main>
  );
}

/** Содержимое плитки фотоархива: титульный кадр и подпись поверх него.
 *  Одно и то же и в ссылке, и без неё — различаются только стрелка
 *  и подпись для читалки экрана: без ссылки вести некуда. */
function ArchiveTile({ linked }: { linked: boolean }) {
  const { cover, coverAlt, label, note } = productionMedia.archive;
  return (
    <>
      <Image
        src={mediaSrc(cover)}
        alt={coverAlt}
        fill
        quality={90}
        sizes="(max-width: 640px) 100vw, 33vw"
      />
      <span className={styles.archiveCaption}>
        <span className={styles.archiveLabel}>
          {label}
          {linked && (
            <span className={styles.archiveArrow} aria-hidden="true">
              →
            </span>
          )}
        </span>
        <span className={styles.archiveNote}>{note}</span>
      </span>
    </>
  );
}
