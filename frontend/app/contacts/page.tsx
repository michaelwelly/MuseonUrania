import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import VedalMap from "@/components/VedalMap";
import { staff, DEMO_NOTE } from "@/content/staff";
import {
  contactsHero,
  topics,
  contactBlocks,
  route,
  staffSection,
  legalRows,
  contactsNotice,
  uraniaCard,
} from "@/content/contacts";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Контакты — VEDAL",
  description: contactsHero.lead,
};

const mainClass = (title: string) =>
  title === "Телефон" ? styles.mainPhone : title === "Почта" ? styles.mainMail : styles.mainAddress;

export default function ContactsPage() {
  return (
    <main className={styles.page}>
      <PageHero
        crumbs={[{ label: "Главная", href: "/" }, { label: "Контакты" }]}
        title={contactsHero.title}
        lead={contactsHero.lead}
      />

      <ul className={styles.blocks}>
        {contactBlocks.map((b) => (
          <li key={b.title} className={styles.block}>
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
        <div className={styles.routePanel}>
          <p className={styles.eyebrow}>{route.eyebrow}</p>
          <h2 className={styles.routeTitle}>{route.title}</h2>
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
        <div className={styles.mapSlot}>
          <VedalMap />
        </div>
      </section>

      <section className={styles.staff}>
        <div className={styles.staffHead}>
          <div>
            <p className={styles.eyebrow} style={{ color: "var(--green)" }}>
              {staffSection.eyebrow}
            </p>
            <h2 className={styles.h2}>{staffSection.title}</h2>
          </div>
          {/* Требование хендоффа: примечание видно до замены на реальные данные. */}
          <p className={styles.staffNote}>{DEMO_NOTE}</p>
        </div>

        <ul className={styles.staffGrid}>
          {staff.map((p) => (
            <li key={p.email} className={styles.person}>
              <div className={styles.personTop}>
                <div className={styles.avatar}>
                  <Image src="/urania/urania-avatar-middle-v1.png" alt="" fill sizes="60px" />
                </div>
                <div>
                  <p className={styles.personName}>{p.name}</p>
                  <p className={styles.personRole}>{p.role}</p>
                </div>
              </div>
              <p className={styles.personScope}>{p.scope}</p>
              <address className={styles.personContacts}>
                <a className={styles.personPhone} href={`tel:${p.phone.replace(/[\s+]/g, "")}`}>
                  {p.phone}
                </a>
                <a className={styles.personMail} href={`mailto:${p.email}`}>
                  {p.email}
                </a>
              </address>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.bottom}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Оставить обращение</h2>
          <LeadForm
            topics={topics}
            analytics="quote_form_submit"
            submitLabel="Отправить обращение"
            messageLabel="Сообщение"
          />
        </div>

        <div className={styles.aside}>
          <div className={styles.legalCard}>
            <h2 className={styles.legalTitle}>Реквизиты</h2>
            {legalRows.map((row) => (
              <div key={row.label} className={styles.legalRow}>
                <span className={styles.legalLabel}>{row.label}</span>
                <span>{row.value}</span>
              </div>
            ))}
          </div>

          <div className={styles.uraniaCard}>
            <h2 className={styles.uraniaTitle}>{uraniaCard.title}</h2>
            <p className={styles.uraniaText}>{uraniaCard.text}</p>
            <Link className={styles.uraniaCta} href="#urania">
              {uraniaCard.cta}
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.notice}>
        <h2 className={styles.noticeTitle}>{contactsNotice.title}</h2>
        <p className={styles.noticeText}>{contactsNotice.text}</p>
      </section>
    </main>
  );
}
