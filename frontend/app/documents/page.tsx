import type { Metadata } from "next";
import { hero } from "@/content/site";
import {
  documentsHero,
  documents,
  sections,
  documentsNotice,
} from "@/content/documents";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Документы — VEDAL",
  description: documentsHero.lead,
};

export default function DocumentsPage() {
  return (
    <main className={styles.page}>
      <section className={styles.section}>
        <p className={styles.eyebrow}>{documentsHero.eyebrow}</p>
        <h1 className={styles.h1}>{documentsHero.headline}</h1>
        <p className={styles.lead}>{documentsHero.lead}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Документация по изделиям</h2>
        <ul className={styles.docs}>
          {documents.map((doc) => (
            <li key={doc.title} className={styles.doc}>
              <div className={styles.docMain}>
                <p className={styles.docTitle}>{doc.title}</p>
                <p className={styles.docMeta}>
                  {doc.type} · {doc.products}
                </p>
              </div>

              <p
                className={`${styles.status} ${
                  doc.published ? styles.published : styles.awaiting
                }`}
              >
                {doc.published ? "Опубликован" : "Ожидает подтверждения публикации"}
              </p>

              {doc.published && doc.file ? (
                <a className={styles.action} href={doc.file} download data-analytics="document_download_click">
                  Скачать PDF
                </a>
              ) : (
                <a className={styles.action} href={hero.primaryCta.href}>
                  Запросить документ
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Что готовится</h2>
        <ul className={styles.grid}>
          {sections.map((s) => (
            <li key={s.title} className={styles.card}>
              <h3 className={styles.cardTitle}>{s.title}</h3>
              <p className={styles.cardText}>{s.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{documentsNotice.title}</h2>
        <p className={styles.note}>{documentsNotice.text}</p>
      </section>

      <section className={styles.section}>
        <div className={styles.assistant}>
          <div>
            <h2 className={styles.h2}>Нужен документ по изделию?</h2>
            <p className={styles.lead}>
              Укажите изделие и назначение — специалист пришлёт актуальную редакцию.
            </p>
          </div>
          <a className={styles.button} href={hero.primaryCta.href}>
            Запросить документ
          </a>
        </div>
      </section>
    </main>
  );
}
