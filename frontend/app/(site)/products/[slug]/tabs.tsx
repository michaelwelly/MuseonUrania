"use client";

import { useState } from "react";
import Link from "next/link";
import type { Doc, Product } from "@/lib/api";
import { REQUEST_HREF, accessBadge, docHref, docNote, isOpen, linkTarget } from "@/lib/documents";
import styles from "./page.module.css";

const ALL_TABS = ["Характеристики", "Комплектация", "Документы", "Сервис и обучение"] as const;
type Tab = (typeof ALL_TABS)[number];

// Вкладка «Комплектация» снята по просьбе заказчика после показа стенда
// (issue #83) — на всех четырёх карточках изделий набор вкладок общий,
// поэтому одна правка здесь убирает её везде. Панель ниже (JSX-ветка
// tab === "Комплектация") нарочно оставлена в файле: заказчик может
// попросить вернуть вкладку, и тогда это одна строка — убрать её из
// HIDDEN_TABS, — а не восстановление текста заново.
const HIDDEN_TABS: readonly Tab[] = ["Комплектация"];
const TABS = ALL_TABS.filter((t) => !HIDDEN_TABS.includes(t));

// Раньше здесь стоял список из трёх строк, набранный руками: «Описание
// изделия», «Регистрационное удостоверение», «Каталог продукции 2026» —
// одинаковый на каждой карточке и ведущий на форму независимо от того,
// что лежит в перечне портала. Это нарушало сразу два правила: карточка
// утверждала наличие документов, которых у изделия может не быть, и не
// показывала файл, когда он есть.
//
// Теперь перечень приходит из портала (issue #73). Правило ссылки — общее
// с /documents/, оно в lib/documents.

// Индекс, а не сам текст таба: id должен остаться стабильным символом
// (латиница/цифры), а названия табов — кириллица с пробелами.
const tabId = (t: Tab) => `product-tab-${TABS.indexOf(t)}`;
const panelId = "product-tabpanel";

export default function ProductTabs({
  product,
  documents,
}: {
  product: Product;
  /** Документы этого изделия. Отбор делает страница — см. lib/documents.forProduct. */
  documents: Doc[];
}) {
  const [tab, setTab] = useState<Tab>("Характеристики");

  return (
    <>
      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            id={tabId(t)}
            type="button"
            role="tab"
            aria-selected={tab === t}
            aria-controls={panelId}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <section
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(tab)}
        className={styles.panel}
      >
        {tab === "Характеристики" &&
          (product.specs ? (
            <>
              <h2 className={styles.panelTitle}>Характеристики</h2>
              <div className={styles.specs}>
                {product.specs.map((s) => (
                  <div key={s.label} className={styles.spec}>
                    <span className={styles.specLabel}>{s.label}</span>
                    <span className={s.muted ? styles.specMuted : undefined}>{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className={styles.panelTitle}>Характеристики</h2>
              <p className={styles.awaiting}>
                Технические характеристики этой позиции выдаются по запросу — датащит ещё не
                передан для публикации. Укажите модель в заявке, специалист пришлёт документацию.
              </p>
            </>
          ))}

        {tab === "Комплектация" && (
          <>
            <h2 className={styles.panelTitle}>Комплектация</h2>
            <p className={styles.awaiting}>
              Состав поставки и опции согласуются под задачу отделения. Базовая комплектация и
              перечень опций — ожидает уточнения.
            </p>
          </>
        )}

        {tab === "Документы" && (
          <>
            <h2 className={styles.panelTitle}>Документы к изделию</h2>

            {documents.length === 0 ? (
              // Пустая вкладка честнее выдуманного списка: у изделия может
              // не быть ни одной строки в перечне, и рисовать кнопку под
              // документ, которого нет, нельзя.
              <p className={styles.awaiting}>
                В перечне документов пока нет ни одной строки об этом изделии. Документация
                выдаётся по запросу — укажите модель в заявке, специалист пришлёт актуальную
                редакцию.
              </p>
            ) : (
              <ul className={styles.docs}>
                {documents.map((d) => (
                  <li key={d.slug || d.title}>
                    <Link className={styles.doc} href={docHref(d)} {...linkTarget(d)}>
                      <span
                        className={`${styles.docKind} ${
                          isOpen(d) ? styles.docKindOpen : styles.docKindMuted
                        }`}
                      >
                        {accessBadge(d)}
                      </span>
                      <span className={styles.docBody}>
                        <span className={styles.docTitle}>{d.title}</span>
                        <span className={styles.docNote}>{docNote(d)}</span>
                      </span>
                      <span className={styles.docArrow} aria-hidden="true">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {/* Документы компании — лицензия, сертификат системы качества,
                каталог — к изделию не привязаны и живут в общем перечне.
                Ссылка ведёт туда, а не подмешивает их в список изделия. */}
            <p className={styles.docsAll}>
              <Link href="/documents/">Все документы и лицензирование</Link> · не найденное
              в перечне <Link href={REQUEST_HREF}>запрашивается</Link> у специалиста.
            </p>
          </>
        )}

        {tab === "Сервис и обучение" && (
          <>
            <h2 className={styles.panelTitle}>Сервис и обучение</h2>
            <div className={styles.service}>
              <p className={styles.serviceTitle}>Сервис и обучение персонала</p>
              <p className={styles.serviceText}>
                Монтаж, настройка и обучение — по заявке. Сервисный инженер отвечает в рабочие
                часы.
              </p>
              <Link className={styles.serviceBtn} href="/service/">
                Сервисная заявка
              </Link>
            </div>
          </>
        )}
      </section>
    </>
  );
}
