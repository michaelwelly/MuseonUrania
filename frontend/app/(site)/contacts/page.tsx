import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import VedalMap from "@/components/VedalMap";
import { fetchProducts } from "@/lib/api";
import { companyContact, STAFF_AWAITING } from "@/content/staff";
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
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Контакты — VEDAL",
  description: contactsHero.lead,
};

const mainClass = (title: string) =>
  title === "Телефон" ? styles.mainPhone : title === "Почта" ? styles.mainMail : styles.mainAddress;

export default async function ContactsPage() {
  // Селектор изделия в форме — тот же каталог, что на /products/.
  const products = await fetchProducts();

  return (
    <main className={styles.page}>
      <PageHero
        crumbs={[{ label: "Главная", href: "/" }, { label: "Контакты" }]}
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
                <span className={mainClass(b.title)}>{b.main.text}</span>
              )}
              {b.lines.map((l) => (
                <span key={l.text} className={l.href ? styles.line : styles.lineDim}>
                  {l.href ? <a href={l.href}>{l.text}</a> : l.text}
                </span>
              ))}
            </address>
          </li>
        ))}
      </ul>

      <section className={styles.route}>
        <div className={styles.routePanel} data-reveal="0">
          <p className={styles.eyebrow}>{route.eyebrow}</p>
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
          <Link className={styles.routeCta} href="/production/#map">
            {route.cta}
          </Link>
        </div>
        <div className={styles.mapSlot} data-reveal="1">
          <VedalMap />
        </div>
      </section>

      {/* Блок «Кому писать напрямую» снят: все шесть карточек были
          придуманными людьми с придуманными телефонами, а примечание рядом
          не мешает по такому телефону позвонить. Вернётся, когда заказчик
          подтвердит список — §9.3 плана, см. content/staff.ts. */}
      <section className={styles.staffPending} data-reveal="0">
        <p className={styles.eyebrow} style={{ color: "var(--green)" }}>
          {staffSection.eyebrow}
        </p>
        <h2 className={styles.h2} data-words="30">
          {staffSection.title}
        </h2>
        <p className={styles.staffNote}>{STAFF_AWAITING}</p>
        <address className={styles.staffFallback}>
          <a href={`tel:${companyContact.phone.replace(/\s/g, "")}`}>{companyContact.phone}</a>
          <a href={`mailto:${companyContact.email}`}>{companyContact.email}</a>
        </address>
      </section>

      <section className={styles.bottom}>
        <div className={styles.card} data-reveal="0">
          <h2 className={styles.cardTitle} data-words="30">
            Оставить обращение
          </h2>
          <LeadForm
            form="quote"
            topics={topics}
            products={products}
            analytics="quote_form_submit"
            submitLabel="Отправить обращение"
            messageLabel="Сообщение"
          />
        </div>

        <div className={styles.aside} data-reveal="1">
          <div className={styles.legalCard}>
            <h2 className={styles.legalTitle}>Реквизиты</h2>
            {legalRows.map((row) => (
              <div key={row.label} className={styles.legalRow}>
                <span className={styles.legalLabel}>{row.label}</span>
                <span>{row.value}</span>
              </div>
            ))}
          </div>

          <div className={styles.vedalinaCard}>
            <h2 className={styles.vedalinaTitle}>{vedalinaCard.title}</h2>
            <p className={styles.vedalinaText}>{vedalinaCard.text}</p>
            <Link className={styles.vedalinaCta} href="#vedalina">
              {vedalinaCard.cta}
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.notice} data-reveal="0">
        <h2 className={styles.noticeTitle} data-words="30">
          {contactsNotice.title}
        </h2>
        <p className={styles.noticeText}>{contactsNotice.text}</p>
      </section>
    </main>
  );
}
