"use client";

import { useState } from "react";
import Link from "next/link";
import { groups } from "@/content/documents";
import { ui as strings } from "@/content/ui";
import type { Doc } from "@/lib/api";
import { accessBadge, actionLabel, badgeIsOk, docHref, linkTarget, requestHref } from "@/lib/documents";
import styles from "./page.module.css";

// Перечень приходит сверху: его читает серверный компонент на сборке.
// Ссылка на файл есть только у опубликованных — её ставит бэкенд.
//
export default function DocumentsTable({ documents }: { documents: Doc[] }) {
  // Фильтр сравнивает с полем `group` из API — тем же значением, что стоит
  // на чипе.
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
          {strings.documents.all}
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
        {/* Склонение «документ / документа / документов» живёт в словаре:
            в английском форм две, в китайском одна, и правило числа —
            свойство языка, а не разметки. */}
        <span className={styles.count} aria-live="polite">
          {strings.documents.count(shown.length)}
        </span>
      </div>

      {/* Ревил на обёртке, а не на строках: список перерисовывается фильтром. */}
      <div className={styles.tableWrap} data-reveal="0">
        <div className={styles.table}>
          <div className={styles.head}>
            <span>{strings.documents.headName}</span>
            <span>{strings.documents.headGroup}</span>
            <span>{strings.documents.headProduct}</span>
            <span>{strings.documents.headAccess}</span>
          </div>

          {shown.length === 0 && <p className={styles.empty}>{strings.documents.empty}</p>}

          {/* Куда ведёт строка и что говорит бейдж — решает lib/documents:
              то же правило работает на вкладке «Документы» карточки изделия.
              Языковой префикс дописывается здесь: правило про документ
              не должно знать про языки, а форма запроса живёт на том же
              языке, что и перечень. */}
          {shown.map((d) => (
            <Link
              key={d.slug || `${d.title}-${d.product}`}
              className={styles.row}
              href={docHref(d, requestHref(d))}
              {...linkTarget(d)}
              data-analytics="document_download_click"
            >
              <span className={styles.cell}>
                <span className={styles.docTitle}>{d.title}</span>
                {/* Что произойдёт по нажатию — словами. Без этой строки
                    «Запросить» отличается от «Открыть» только адресом
                    в статусной строке браузера. Это подпись интерфейса,
                    поэтому она приходит из словаря, а не из содержания. */}
                <span className={styles.action}>{actionLabel(d, strings.documents)}</span>
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
