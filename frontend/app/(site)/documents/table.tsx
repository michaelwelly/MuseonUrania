"use client";

import { useState } from "react";
import Link from "next/link";
import { groups } from "@/content/documents";
import type { Doc } from "@/lib/api";
import { accessBadge, actionLabel, badgeIsOk, docHref, linkTarget } from "@/lib/documents";
import styles from "./page.module.css";

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

          {/* Куда ведёт строка и что говорит бейдж — решает lib/documents:
              то же правило работает на вкладке «Документы» карточки изделия. */}
          {shown.map((d) => (
            <Link
              key={d.slug || `${d.title}-${d.product}`}
              className={styles.row}
              href={docHref(d)}
              {...linkTarget(d)}
              data-analytics="document_download_click"
            >
              <span className={styles.cell}>
                <span className={styles.docTitle}>{d.title}</span>
                {/* Что произойдёт по нажатию — словами. Без этой строки
                    «Запросить» отличается от «Открыть» только адресом
                    в статусной строке браузера. */}
                <span className={styles.action}>{actionLabel(d)}</span>
              </span>
              <span className={styles.dim}>{d.group}</span>
              <span className={`${styles.dim} ${styles.product}`}>{d.product}</span>
              <span
                className={`${styles.badge} ${badgeIsOk(d) ? styles.badgeOk : styles.badgeMuted}`}
              >
                {accessBadge(d)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
