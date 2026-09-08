import type { Metadata } from "next";
import Image from "next/image";
import { pageMetadata } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import TranslationNotice from "@/components/TranslationNotice";
import VedalMap from "@/components/VedalMap";
import VedalMapEmbed from "@/components/VedalMapEmbed";
import { fetchProducts } from "@/lib/api";
import { companyContact, STAFF_AWAITING } from "@/content/staff";
import { vedalina } from "@/content/vedalina";
import {
  contactsHero,
  topics,
  contactBlocks,
  route,
  staffSection,
  legalRows,
  contactsNotice,
  vedalinaCard,
} from "@/content/contacts";
import { ui } from "@/content/ui";
import { contentText } from "@/lib/content-i18n";
import { localePath, type Lang } from "@/lib/i18n";
import styles from "./page.module.css";

// Контакты. Тело страницы вынесено из `page.tsx` сюда, потому что его рисуют
// два маршрута: `/contacts/` (русский, `app/(site)`) и `/[lang]/contacts/`
// (переведённый, `app/(intl)`). Файл `screen.tsx` маршрутом не является,
// поэтому здесь можно держать любые экспорты, чего `page.tsx` не позволяет.
//
// Язык приходит пропом. Интерфейс берётся из `content/ui.ts`, содержательный
// текст — через `contentText`: перевод, если он согласован, иначе русский
// оригинал с пометкой `lang="ru"`.

export function contactsMetadata(lang: Lang): Metadata {
  const strings = ui(lang);
  const c = contentText(lang);
  return pageMetadata({
    title: strings.meta.contacts,
    // Подзаголовок первого экрана — содержательный текст: он обещает,
    // что запрос попадёт в нужный отдел. Переводится только вместе
    // с остальным контентом, до этого едет в описание по-русски.
    description: c.t(contactsHero.lead),
    path: "/contacts/",
    lang,
  });
}

// Стиль главной строки карточки выбирается по РУССКОМУ оригиналу подписи,
// а не по переведённой: на английской и китайской версиях сравнение
// с «Телефон» и «Почта» не совпало бы ни разу, и все три карточки получили бы
// стиль адреса. Подпись переводится отдельно, ниже, через `blockTitles`.
const mainClass = (title: string) =>
  title === "Телефон" ? styles.mainPhone : title === "Почта" ? styles.mainMail : styles.mainAddress;

export default async function ContactsScreen({ lang }: { lang: Lang }) {
  const strings = ui(lang);
  const c = contentText(lang);
  const at = (path: string) => localePath(lang, path);

  // Селектор изделия в форме — тот же каталог, что на /products/.
  const products = await fetchProducts();

  return (
    <main className={styles.page}>
      {/* Заголовок и подзаголовок первого экрана — содержательный текст,
          но пометить его `lang="ru"` здесь нечем: `PageHero` принимает
          строки, а не разметку, и своего атрибута языка не выставляет.
          Про непереведённое говорит примечание сразу под ним. */}
      <PageHero
        crumbs={[
          { label: strings.crumbs.home, href: at("/") },
          { label: strings.crumbs.contacts },
        ]}
        title={c.t(contactsHero.title)}
        lead={c.t(contactsHero.lead)}
        textLang={c.mark(contactsHero.title, contactsHero.lead)}
      />

      {/* Примечание о непереведённом стоит сразу после первого экрана:
          дальше идут реквизиты, схема проезда и текст про персональные
          данные — их перевод согласовывает заказчик. Для русской версии
          не рисуется. */}
      <TranslationNotice lang={lang} />

      <ul className={styles.blocks}>
        {contactBlocks.map((b, i) => (
          <li key={b.title} className={styles.block} data-reveal={i}>
            {/* Подписи карточек — интерфейс: они ничего не утверждают об
                изделии, поэтому переводятся нами. Ключ словаря — русский
                оригинал; нет перевода — остаётся он же. */}
            <p className={styles.blockTitle}>{strings.contacts.blockTitles[b.title] ?? b.title}</p>
            <address className={styles.contacts}>
              {b.main.href ? (
                <a className={mainClass(b.title)} href={b.main.href} lang={c.mark(b.main.text)}>
                  {c.t(b.main.text)}
                </a>
              ) : (
                <span className={mainClass(b.title)} lang={c.mark(b.main.text)}>
                  {c.t(b.main.text)}
                </span>
              )}
              {b.lines.map((l) => (
                <span
                  key={l.text}
                  className={l.href ? styles.line : styles.lineDim}
                  lang={c.mark(l.text)}
                >
                  {l.href ? <a href={l.href}>{c.t(l.text)}</a> : c.t(l.text)}
                </span>
              ))}
            </address>
          </li>
        ))}
      </ul>

      <section className={styles.route}>
        <div className={styles.routePanel} data-reveal="0">
          <p className={styles.eyebrow} lang={c.mark(route.eyebrow)}>
            {c.t(route.eyebrow)}
          </p>
          <h2 className={styles.routeTitle} data-words="30" lang={c.mark(route.title)}>
            {c.t(route.title)}
          </h2>
          <ul className={styles.routeRows}>
            {/* Ориентир и порядок въезда — утверждения о площадке: их
                переводит заказчик, а не мы. */}
            {route.rows.map((r) => (
              <li key={r.label} className={styles.routeRow} lang={c.mark(r.label, r.value)}>
                <p className={styles.routeLabel}>{c.t(r.label)}</p>
                <p className={styles.routeValue}>{c.t(r.value)}</p>
              </li>
            ))}
          </ul>
          {/* Ссылка остаётся и после того, как появилась встроенная карта
              (issue #74): она работает у всех — у отказавшегося от кадра,
              у браузера без JS и у поисковика, — и ведёт на Яндекс.Карты
              по адресу производства, никуда ничего не отправляя до клика. */}
          <a
            className={styles.routeCta}
            href={route.ctaHref}
            target="_blank"
            rel="noopener"
            lang={c.mark(route.cta)}
          >
            {c.t(route.cta)}
          </a>
        </div>
        <div className={styles.mapSlot} data-reveal="1">
          {/* Кадр Яндекс.Карт — только после согласия в плашке про cookie,
              по тому же признаку, что поднимает счётчик Метрики (issue #53).
              Без согласия остаётся схема проезда на CSS, а адрес и маршрут
              стоят в панели слева. */}
          <VedalMapEmbed src={route.mapSrc} title={c.t(route.mapTitle)}>
            <VedalMap />
          </VedalMapEmbed>
        </div>
      </section>

      {/* Блок «Кому писать напрямую» снят: все шесть карточек были
          придуманными людьми с придуманными телефонами, а примечание рядом
          не мешает по такому телефону позвонить. Вернётся, когда заказчик
          подтвердит список — §9.3 плана, см. content/staff.ts. */}
      <section className={styles.staffPending} data-reveal="0">
        <p
          className={styles.eyebrow}
          style={{ color: "var(--green-dark)" }}
          lang={c.mark(staffSection.eyebrow)}
        >
          {c.t(staffSection.eyebrow)}
        </p>
        <h2 className={styles.h2} data-words="30" lang={c.mark(staffSection.title)}>
          {c.t(staffSection.title)}
        </h2>
        {/* «Ожидает уточнения» — статус, а не состояние интерфейса: он
            говорит, чего заказчик ещё не передал. Машинный перевод такого
            статуса читается как обещание, поэтому только откат на русский. */}
        <p className={styles.staffNote} lang={c.mark(STAFF_AWAITING)}>
          {c.t(STAFF_AWAITING)}
        </p>
        <address className={styles.staffFallback}>
          <a href={`tel:${companyContact.phone.replace(/\s/g, "")}`}>{companyContact.phone}</a>
          <a href={`mailto:${companyContact.email}`}>{companyContact.email}</a>
        </address>
      </section>

      <section className={styles.bottom}>
        <div className={styles.card} data-reveal="0">
          <h2 className={styles.cardTitle} data-words="30">
            {strings.contacts.formTitle}
          </h2>
          <LeadForm
            form="quote"
            topics={topics}
            products={products}
            analytics="quote_form_submit"
            lang={lang}
            submitLabel={strings.actions.sendEnquiry}
            messageLabel={strings.contacts.messageLabel}
          />
        </div>

        <div className={styles.aside} data-reveal="1">
          <div className={styles.legalCard}>
            <h2 className={styles.legalTitle}>{strings.contacts.legalTitle}</h2>
            {/* Реквизиты оператора — юридический текст: наименование
                общества, ИНН, КПП и адрес. Ни одной строки не переводим
                сами, только откат на русский. */}
            {legalRows.map((row) => (
              <div key={row.label} className={styles.legalRow} lang={c.mark(row.label, row.value)}>
                <span className={styles.legalLabel}>{c.t(row.label)}</span>
                <span>{c.t(row.value)}</span>
              </div>
            ))}
          </div>

          <div className={styles.vedalinaCard}>
            {/* Портрет добавлен по просьбе заказчика после показа стенда
                (issue #84) — тот же файл, что у виджета чата и в блоке
                запроса на /documents/ (content/vedalina.ts → avatar),
                а не путь строкой: имя файла уже менялось однажды. */}
            <div className={styles.vedalinaHead}>
              <div className={styles.vedalinaAvatar}>
                <Image src={vedalina.avatar} alt="" width={48} height={48} />
              </div>
              <h2 className={styles.vedalinaTitle} lang={c.mark(vedalinaCard.title)}>
                {c.t(vedalinaCard.title)}
              </h2>
            </div>
            {/* Карточка обещает от имени компании, что ассистент подберёт
                модель и передаст запрос специалисту, — это утверждение,
                а не подпись кнопки. Поэтому вся карточка идёт через `c.t`. */}
            <p className={styles.vedalinaText} lang={c.mark(vedalinaCard.text)}>
              {c.t(vedalinaCard.text)}
            </p>
            {/* Обычный `<a>`, а не `Link`: виджет Ведалины открывается
                по `hashchange`, а `Link` меняет адрес своим `pushState`
                и события не порождает — кнопка дописывала `#vedalina`
                в адрес, не открывая окна (issue #101). */}
            <a className={styles.vedalinaCta} href="#vedalina" lang={c.mark(vedalinaCard.cta)}>
              {c.t(vedalinaCard.cta)}
            </a>
          </div>
        </div>
      </section>

      {/* Что именно форма делает с данными и в каком состоянии политика —
          юридическое утверждение о самих себе. Такой абзац в переводе
          требует согласования ровно так же, как и сама политика. */}
      <section className={styles.notice} data-reveal="0">
        <h2 className={styles.noticeTitle} data-words="30" lang={c.mark(contactsNotice.title)}>
          {c.t(contactsNotice.title)}
        </h2>
        <p className={styles.noticeText} lang={c.mark(contactsNotice.text)}>
          {c.t(contactsNotice.text)}
        </p>
      </section>
    </main>
  );
}
