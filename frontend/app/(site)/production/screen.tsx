import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import VedalMap from "@/components/VedalMap";
import TranslationNotice from "@/components/TranslationNotice";
import { site } from "@/content/site";
import { productionHero, facility, gallery, address } from "@/content/production";
import { ui } from "@/content/ui";
import TreeMark from "@/components/TreeMark";
import LivePattern from "@/components/LivePattern";
import styles from "./page.module.css";
import { contentText } from "@/lib/content-i18n";
import { localePath, type Lang } from "@/lib/i18n";
import { mediaSrc } from "@/lib/media";

// «Производство». Тело вынесено из `page.tsx` в `screen.tsx`, потому что его
// рисуют два маршрута: `/production/` (русский) и `/[lang]/production/`.
//
// Тексты страницы описывают площадку — это утверждения о компании, их
// переводит заказчик. Через словарь интерфейса идут только крошки и кнопки.

export function productionMetadata(lang: Lang): Metadata {
  const strings = ui(lang);
  const c = contentText(lang);
  return pageMetadata({
    title: strings.meta.production,
    description: c.t(productionHero.lead),
    path: "/production/",
    lang,
  });
}

export default function ProductionScreen({ lang }: { lang: Lang }) {
  const strings = ui(lang);
  const c = contentText(lang);
  const at = (path: string) => localePath(lang, path);

  return (
    <main className={styles.page}>
      {/* Паттерна нет по той же причине, что на главной: правая половина
          полосы занята фото во всю высоту. */}
      <section className={`${styles.hero} patternHost`}>
        <LivePattern variant={1} placement="seam" />
        <div className={styles.heroCopy}>
          <p className={styles.crumbs}>
            <Link href={at("/")}>{strings.crumbs.home}</Link> / {strings.crumbs.production}
          </p>
          <h1
            className={styles.h1}
            data-words="34"
            data-wdelay="110"
            lang={c.mark(productionHero.title)}
          >
            {c.t(productionHero.title)}
          </h1>
          <p
            className={styles.lead}
            data-words="13"
            data-wdelay="400"
            lang={c.mark(productionHero.lead)}
          >
            {c.t(productionHero.lead)}
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
            alt={c.t(productionHero.image.alt)}
            fill
            sizes="(max-width: 1100px) 100vw, 50vw"
            priority
          />
        </div>
      </section>

      {/* Примечание о непереведённом стоит сразу после первого экрана:
          ниже идёт рассказ о площадке и её адрес, их перевод согласовывает
          заказчик. Для русской версии не рисуется. */}
      <TranslationNotice lang={lang} />

      <section className={styles.facility}>
        <div data-reveal="0">
          <p className={styles.eyebrow} lang={c.mark(facility.eyebrow)}>
            {c.t(facility.eyebrow)}
          </p>
          <h2 className={styles.h2} data-words="30" lang={c.mark(facility.title)}>
            {c.t(facility.title)}
          </h2>
        </div>
        <div data-reveal="1">
          {facility.paragraphs.map((p) => (
            <p key={p} className={styles.paragraph} lang={c.mark(p)}>
              {c.t(p)}
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
                alt={c.t(shot.alt)}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
              />
            </div>
          </li>
        ))}
      </ul>

      <section className={styles.address} id="map">
        <div className={styles.addressCopy} data-reveal="0">
          <p className={styles.eyebrow} lang={c.mark(address.eyebrow)}>
            {c.t(address.eyebrow)}
          </p>
          <h2 className={styles.addressTitle} data-words="30" lang={c.mark(address.title)}>
            {c.t(address.title)}
          </h2>
          <address className={styles.addressLines}>
            {address.lines.map((line) => (
              <span key={line} lang={c.mark(line)}>
                {c.t(line)}
              </span>
            ))}
            <span>
              {/* Часы берутся из словаря интерфейса, а не из `address.hours`:
                  тот же самый режим работы уже переведён для шапки
                  (`content/ui.ts` → `header.hours`), и второй источник
                  разошёлся бы с первым молча — на английской странице шапка
                  говорила бы «Mon–Fri», а адрес производства «Пн–Пт». */}
              {strings.header.hours} ·{" "}
              <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>
            </span>
          </address>
          <Link
            className={`${styles.btn} ${styles.btnOutline} ${styles.addressCta}`}
            href={at("/contacts/")}
          >
            {strings.actions.getDirections}
          </Link>
        </div>
        <div className={styles.mapSlot} data-reveal="1">
          <VedalMap />
        </div>
      </section>
    </main>
  );
}
