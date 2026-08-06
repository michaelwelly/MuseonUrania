import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { documentsHero, order, request } from "@/content/documents";
import { docsSpecialist, DEMO_NOTE } from "@/content/staff";
import DocumentsTable from "./table";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Документы и лицензирование — VEDAL",
  description: documentsHero.lead,
};

export default function DocumentsPage() {
  return (
    <main className={styles.page}>
      <PageHero
        crumbs={[{ label: "Главная", href: "/" }, { label: "Документы" }]}
        title={documentsHero.title}
        lead={documentsHero.lead}
        aside={
          <Link className={styles.heroBtn} href="/contacts/">
            Запросить документ
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M2 8h11M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="square"
              />
            </svg>
          </Link>
        }
      />

      <DocumentsTable />

      <section className={styles.order}>
        <div data-reveal="0">
          <p className={styles.eyebrow}>{order.eyebrow}</p>
          <h2 className={styles.h2} data-words="30">
            {order.title}
          </h2>
          <p className={styles.orderText}>{order.text}</p>

          <ul className={styles.legend}>
            {order.legend.map((l) => (
              <li key={l.badge} className={styles.legendRow}>
                <span
                  className={`${styles.legendBadge} ${
                    l.badge === "Уточняется" ? styles.badgeMuted : styles.badgeOk
                  }`}
                >
                  {l.badge}
                </span>
                {l.text}
              </li>
            ))}
          </ul>

          <p className={styles.note}>{order.note}</p>
        </div>

        <div className={styles.request} data-reveal="1">
          <h2 className={styles.requestTitle} data-words="30">
            {request.title}
          </h2>
          <p className={styles.requestText}>{request.text}</p>

          <div className={styles.contact}>
            <div className={styles.avatar}>
              <Image src="/urania/urania-avatar-middle-v1.png" alt="" fill sizes="48px" />
            </div>
            <div>
              <p className={styles.contactName}>{docsSpecialist.name}</p>
              <p className={styles.contactRole}>
                {docsSpecialist.role} ·{" "}
                <a href={`mailto:${docsSpecialist.email}`}>{docsSpecialist.email}</a>
              </p>
            </div>
          </div>
          {/* Контакт — заглушка из макета, см. content/staff.ts */}
          <p className={styles.demoNote}>{DEMO_NOTE}</p>
        </div>
      </section>
    </main>
  );
}
