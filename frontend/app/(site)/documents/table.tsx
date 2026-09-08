"use client";

import { useState } from "react";
import Link from "next/link";
import { groups } from "@/content/documents";
import { ui } from "@/content/ui";
import type { Doc } from "@/lib/api";
import { REQUEST_HREF, accessBadge, actionLabel, badgeIsOk, docHref, linkTarget } from "@/lib/documents";
import { contentText } from "@/lib/content-i18n";
import { localePath, type Lang } from "@/lib/i18n";
import styles from "./page.module.css";

// Перечень приходит сверху: его читает серверный компонент на сборке.
// Ссылка на файл есть только у опубликованных — её ставит бэкенд.
//
// Язык тоже приходит сверху: клиентский компонент не разбирает адрес сам,
// иначе про языки знали бы два места — маршрут и этот файл.
export default function DocumentsTable({ documents, lang }: { documents: Doc[]; lang: Lang }) {
  // Фильтр держит русский оригинал группы, а не показанный текст: сравнение
  // идёт с полем `group` из API, и после перевода чипа оно бы не совпало.
  const [active, setActive] = useState<string | null>(null);
  const shown = active ? documents.filter((d) => d.group === active) : documents;
  const strings = ui(lang);
  const c = contentText(lang);

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
            lang={c.mark(g)}
          >
            {c.t(g)}
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
              href={docHref(d, localePath(lang, REQUEST_HREF))}
              {...linkTarget(d)}
              data-analytics="document_download_click"
              // Название документа, раздел, изделие и статус доступа — всё
              // это утверждения о разрешительных документах. Строка
              // помечается русской, если хоть одно из них не переведено.
              lang={c.mark(d.title, d.group, d.product, accessBadge(d))}
            >
              <span className={styles.cell}>
                <span className={styles.docTitle}>{c.t(d.title)}</span>
                {/* Что произойдёт по нажатию — словами. Без этой строки
                    «Запросить» отличается от «Открыть» только адресом
                    в статусной строке браузера. Это подпись интерфейса,
                    поэтому она приходит из словаря, а не из содержания. */}
                <span className={styles.action}>{actionLabel(d, strings.documents)}</span>
              </span>
              <span className={styles.dim}>{c.t(d.group)}</span>
              <span className={`${styles.dim} ${styles.product}`}>{c.t(d.product)}</span>
              <span
                className={`${styles.badge} ${badgeIsOk(d) ? styles.badgeOk : styles.badgeMuted}`}
              >
                {c.t(accessBadge(d))}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
