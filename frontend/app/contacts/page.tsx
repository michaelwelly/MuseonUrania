import type { Metadata } from "next";
import LeadForm from "@/components/LeadForm";
import {
  contactsHero,
  topics,
  contactBlocks,
  legalRows,
  contactsNotice,
} from "@/content/contacts";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Контакты — VEDAL",
  description: contactsHero.lead,
};

export default function ContactsPage() {
  return (
    <main className={styles.page}>
      <section className={styles.section}>
        <p className={styles.eyebrow}>{contactsHero.eyebrow}</p>
        <h1 className={styles.h1}>{contactsHero.headline}</h1>
        <p className={styles.lead}>{contactsHero.lead}</p>

        <ul className={styles.cards}>
          {contactBlocks.map((block) => (
            <li key={block.title} className={styles.card}>
              <p className={styles.cardTitle}>{block.title}</p>
              <address className={styles.lines}>
                {block.lines.map((line) => {
                  const className = line.strong ? styles.strong : styles.muted;
                  return line.href ? (
                    <a key={line.text} className={className} href={line.href}>
                      {line.text}
                    </a>
                  ) : (
                    <span key={line.text} className={className}>
                      {line.text}
                    </span>
                  );
                })}
              </address>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <div className={styles.split}>
          <div>
            <h2 className={styles.h2}>Оставить обращение</h2>
            <p className={styles.lead}>
              Выберите тему — запрос попадёт к профильному специалисту.
            </p>
            <LeadForm
              topics={topics}
              analytics="quote_form_submit"
              submitLabel="Отправить обращение"
            />
          </div>

          <div className={styles.aside}>
            <p className={styles.cardTitle}>Реквизиты</p>
            <table className={styles.table}>
              <tbody>
                {legalRows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{contactsNotice.title}</h2>
        <p className={styles.note}>{contactsNotice.text}</p>
      </section>
    </main>
  );
}
