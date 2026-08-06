"use client";

import { useState } from "react";
import Link from "next/link";
import { groups, documents, type Group, type Access } from "@/content/documents";
import styles from "./page.module.css";

const badgeClass = (access: Access) =>
  access === "Уточняется" ? styles.badgeMuted : styles.badgeOk;

export default function DocumentsTable() {
  const [active, setActive] = useState<Group | null>(null);
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
              key={`${d.title}-${d.product}`}
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
