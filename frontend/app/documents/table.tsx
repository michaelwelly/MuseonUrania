"use client";

import { useState } from "react";
import Link from "next/link";
import { groups } from "@/content/documents";
import type { Doc } from "@/lib/api";
import styles from "./page.module.css";

const badgeClass = (access: string) =>
  access === "Уточняется" ? styles.badgeMuted : styles.badgeOk;

// Перечень приходит сверху: его читает серверный компонент на сборке.
// Ссылка на файл есть только у опубликованных — её ставит бэкенд.
export default function DocumentsTable({ documents }: { documents: Doc[] }) {
  const [active, setActive] = useState<string | null>(null);
  const shown = active ? documents.filter((d) => d.group === active) : documents;

  return (
    <>
      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.chip} ${active === null ? styles.chipActive : ""}`}
          onClick={() => setActive(null)}
          aria-pressed={active === null}
        >
          Все документы
        </button>
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            className={`${styles.chip} ${active === g ? styles.chipActive : ""}`}
            onClick={() => setActive(g)}
            aria-pressed={active === g}
          >
            {g}
          </button>
        ))}
        <span className={styles.count} aria-live="polite">
          {shown.length}{" "}
          {shown.length === 1 ? "документ" : shown.length < 5 ? "документа" : "документов"}
        </span>
      </div>

      {/* Ревил на обёртке, а не на строках: список перерисовывается фильтром. */}
      <div className={styles.tableWrap} data-reveal="0">
        <div className={styles.table}>
          <div className={styles.head}>
            <span>Документ</span>
            <span>Раздел</span>
            <span>Изделие</span>
            <span>Доступ</span>
          </div>

          {shown.length === 0 && <p className={styles.empty}>В этом разделе пока нет документов.</p>}

          {shown.map((d) => (
            <Link
              key={d.slug || `${d.title}-${d.product}`}
              className={styles.row}
              // Пока published:false — ведём на запрос, а не на файл.
              href={d.published && d.file ? d.file : "/contacts/"}
              data-analytics="document_download_click"
            >
              <span className={styles.docTitle}>{d.title}</span>
              <span className={styles.dim}>{d.group}</span>
              <span className={`${styles.dim} ${styles.product}`}>{d.product}</span>
              <span className={`${styles.badge} ${badgeClass(d.access)}`}>{d.access}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
