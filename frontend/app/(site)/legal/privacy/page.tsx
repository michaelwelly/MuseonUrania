import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { privacy } from "@/content/legal";
import styles from "./page.module.css";

export const metadata: Metadata = {
  ...pageMetadata({
    title: `${privacy.title} — VEDAL`,
    description: privacy.lead,
    path: "/legal/privacy/",
  }),
  // Страница со статусом «готовится» не должна попасть в поиск: по запросу
  // «политика VEDAL» человек должен найти документ, а не сообщение о том,
  // что документа пока нет. Снимем, когда появится согласованный текст.
  //
  // canonical при этом остаётся: noindex говорит «не показывать в выдаче»,
  // а canonical — «вот основной адрес этой страницы». Второе нужно и здесь:
  // ссылку на политику ставят из подвала каждой страницы, и адрес у неё
  // должен быть один, а не три по числу хостов.
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <PageHero
        crumbs={[{ label: "Главная", href: "/" }, { label: "Персональные данные" }]}
        title={privacy.title}
        lead={privacy.lead}
      />

      <section className={styles.section}>
        <h2 className={styles.h2}>{privacy.law.title}</h2>
        <p className={styles.text}>{privacy.law.text}</p>
        <ul className={styles.links}>
          {privacy.law.links.map((link) => (
            <li key={link.href}>
              <a href={link.href} target="_blank" rel="noopener noreferrer">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.sectionSoft}>
        <h2 className={styles.h2}>{privacy.operator.title}</h2>
        <dl className={styles.table}>
          {privacy.operator.rows.map((row) => (
            <div key={row.label} className={styles.row}>
              <dt className={styles.rowLabel}>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Состав собираемых данных стоит выше «что действует сейчас»: человек
          сначала должен узнать, что именно с него берут, и только потом —
          какие правила пока действуют. */}
      <section className={styles.section}>
        <h2 className={styles.h2}>{privacy.collected.title}</h2>
        <p className={styles.text}>{privacy.collected.text}</p>
        <ul className={styles.list}>
          {privacy.collected.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{privacy.current.title}</h2>
        <ul className={styles.list}>
          {privacy.current.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className={styles.sectionSoft}>
        <h2 className={styles.h2}>{privacy.scope.title}</h2>
        <ol className={styles.numbered}>
          {privacy.scope.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{privacy.contact.title}</h2>
        <p className={styles.text}>{privacy.contact.text}</p>
        <address className={styles.contacts}>
          <a href={`tel:${privacy.contact.phone.replace(/\s/g, "")}`}>{privacy.contact.phone}</a>
          <a href={`mailto:${privacy.contact.email}`}>{privacy.contact.email}</a>
        </address>
      </section>
    </main>
  );
}
