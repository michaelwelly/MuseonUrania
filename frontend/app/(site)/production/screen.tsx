import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import VedalMap from "@/components/VedalMap";
import VedalMapEmbed from "@/components/VedalMapEmbed";
import { site } from "@/content/site";
import { productionHero, facility, gallery, address } from "@/content/production";
import { ui as strings } from "@/content/ui";
import TreeMark from "@/components/TreeMark";
import LivePattern from "@/components/LivePattern";
import styles from "./page.module.css";
import { mediaSrc } from "@/lib/media";

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
      {/* Паттерна нет по той же причине, что на главной: правая половина
          полосы занята фото во всю высоту. */}
      <section className={`${styles.hero} patternHost`}>
        <LivePattern variant={1} placement="seam" />
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

      <ul className={styles.gallery}>
        {gallery.map((shot, i) => (
          <li key={shot.src} data-reveal={i}>
            <div className={styles.shot}>
              <Image
                src={mediaSrc(shot.src)}
                alt={shot.alt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
              />
            </div>
          </li>
        ))}
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
