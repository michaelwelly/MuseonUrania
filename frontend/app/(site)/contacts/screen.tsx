import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import VedalMap from "@/components/VedalMap";
import VedalMapEmbed from "@/components/VedalMapEmbed";
import { fetchProducts } from "@/lib/api";
import { companyContact } from "@/content/staff";
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
import { ui as strings } from "@/content/ui";
import { LEAD_ANCHOR } from "@/lib/lead-link";
import styles from "./page.module.css";

// Контакты. Тело страницы вынесено из `page.tsx` сюда, потому что
// `screen.tsx` маршрутом не является: здесь можно держать любые экспорты
// и рисовать экран из тестов, чего `page.tsx` не позволяет.
//
// Подписи интерфейса берутся из `content/ui.ts`, всё остальное —
// из `content/contacts.ts`: это утверждения о компании, и правит их заказчик.

export function contactsMetadata(): Metadata {
  return pageMetadata({
    title: strings.meta.contacts,
    description: contactsHero.lead,
    path: "/contacts/",
  });
}

// Стиль главной строки карточки выбирается по её подписи: телефон, почта
// и адрес набраны по-разному. Отдельного поля под это в content/contacts.ts
// нет — карточек три, и заводить его ради трёх значений дороже сравнения.
const mainClass = (title: string) =>
  title === "Телефон" ? styles.mainPhone : title === "Почта" ? styles.mainMail : styles.mainAddress;

export default async function ContactsScreen() {
  // Селектор изделия в форме — тот же каталог, что на /products/.
  const products = await fetchProducts();

  return (
    <main className={styles.page}>
      <PageHero
        crumbs={[
          { label: strings.crumbs.home, href: "/" },
          { label: strings.crumbs.contacts },
        ]}
        title={contactsHero.title}
        lead={contactsHero.lead}
      />

      <ul className={styles.blocks}>
        {contactBlocks.map((b, i) => (
          <li key={b.title} className={styles.block} data-reveal={i}>
            <p className={styles.blockTitle}>{b.title}</p>
            <address className={styles.contacts}>
              {b.main.href ? (
                <a className={mainClass(b.title)} href={b.main.href}>
                  {b.main.text}
                </a>
              ) : (
                <span className={mainClass(b.title)}>
                  {b.main.text}
                </span>
              )}
              {b.lines.map((l) => (
                <span
                  key={l.text}
                  className={l.href ? styles.line : styles.lineDim}
                >
                  {l.href ? <a href={l.href}>{l.text}</a> : l.text}
                </span>
              ))}
            </address>
          </li>
        ))}
      </ul>

      <section className={styles.route}>
        <div className={styles.routePanel} data-reveal="0">
          <p className={styles.eyebrow}>
            {route.eyebrow}
          </p>
          <h2 className={styles.routeTitle} data-words="30">
            {route.title}
          </h2>
          <ul className={styles.routeRows}>
            {route.rows.map((r) => (
              <li key={r.label} className={styles.routeRow}>
                <p className={styles.routeLabel}>{r.label}</p>
                <p className={styles.routeValue}>{r.value}</p>
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
          >
            {route.cta}
          </a>
        </div>
        <div className={styles.mapSlot} data-reveal="1">
          {/* Кадр Яндекс.Карт — только после согласия в плашке про cookie,
              по тому же признаку, что поднимает счётчик Метрики (issue #53).
              Без согласия остаётся схема проезда на CSS, а адрес и маршрут
              стоят в панели слева. */}
          <VedalMapEmbed src={route.mapSrc} title={route.mapTitle}>
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
        >
          {staffSection.eyebrow}
        </p>
        <h2 className={styles.h2} data-words="30">
          {staffSection.title}
        </h2>
        <address className={styles.staffFallback}>
          <a href={`tel:${companyContact.phone.replace(/\s/g, "")}`}>{companyContact.phone}</a>
          <a href={`mailto:${companyContact.email}`}>{companyContact.email}</a>
        </address>
      </section>

      {/* id — цель кнопок «Запросить КП», «Запросить документ» и «Запросить
          подбор» с других страниц (lib/lead-link.ts). Стоит на секции, а не
          на форме: человека надо привести к заголовку «Оставить обращение»,
          а не к первому полю — так же, как на главной с #quote. */}
      <section className={styles.bottom} id={LEAD_ANCHOR}>
        <div className={styles.card} data-reveal="0">
          <h2 className={styles.cardTitle} data-words="30">
            {strings.contacts.formTitle}
          </h2>
          <LeadForm
            form="quote"
            topics={topics}
            products={products}
            analytics="quote_form_submit"
            submitLabel={strings.actions.sendEnquiry}
            messageLabel={strings.contacts.messageLabel}
          />
        </div>

        <div className={styles.aside} data-reveal="1">
          <div className={styles.legalCard}>
            <h2 className={styles.legalTitle}>{strings.contacts.legalTitle}</h2>
            {legalRows.map((row) => (
              <div key={row.label} className={styles.legalRow}>
                <span className={styles.legalLabel}>{row.label}</span>
                <span>{row.value}</span>
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
              <h2 className={styles.vedalinaTitle}>
                {vedalinaCard.title}
              </h2>
            </div>
            <p className={styles.vedalinaText}>
              {vedalinaCard.text}
            </p>
            {/* Обычный `<a>`, а не `Link`: виджет Ведалины открывается
                по `hashchange`, а `Link` меняет адрес своим `pushState`
                и события не порождает — кнопка дописывала `#vedalina`
                в адрес, не открывая окна (issue #101). */}
            <a className={styles.vedalinaCta} href="#vedalina">
              {vedalinaCard.cta}
            </a>
          </div>
        </div>
      </section>

      {/* Что именно форма делает с данными — юридическое утверждение
          о самих себе, и правит его заказчик: текст лежит
          в content/contacts.ts, а не собирается здесь.

          Ссылка стоит отдельной строкой, а не словами внутри абзаца:
          человек читает эту врезку ровно в тот момент, когда решает,
          отдавать ли свои данные, и путь к полному документу должен быть
          виден, а не найден. */}
      <section className={styles.notice} data-reveal="0">
        <h2 className={styles.noticeTitle} data-words="30">
          {contactsNotice.title}
        </h2>
        <div className={styles.noticeText}>
          <p>{contactsNotice.text}</p>
          <Link className={styles.noticeLink} href={contactsNotice.link.href}>
            {contactsNotice.link.label}
          </Link>
        </div>
      </section>
    </main>
  );
}
