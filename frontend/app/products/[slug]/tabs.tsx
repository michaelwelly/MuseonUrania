"use client";

import { useState } from "react";
import Link from "next/link";
import type { Product } from "@/content/products";
import styles from "./page.module.css";

const TABS = ["Характеристики", "Комплектация", "Документы", "Сервис и обучение"] as const;
type Tab = (typeof TABS)[number];

// Документы у всех позиций пока published:false — правило из content/documents.ts.
// Поэтому ссылок на скачивание нет, вместо них запрос через форму.
const docs = [
  { kind: "PDF", title: "Описание изделия", note: "Техническая документация · выдаётся по запросу" },
  { kind: "РУ", title: "Регистрационное удостоверение", note: "Лицензирование · выдаётся по запросу" },
  { kind: "PDF", title: "Каталог продукции 2026", note: "Коммерческие материалы · выдаётся по запросу" },
];

export default function ProductTabs({ product }: { product: Product }) {
  const [tab, setTab] = useState<Tab>("Характеристики");

  return (
    <>
      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <section className={styles.panel}>
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
            <ul className={styles.docs}>
              {docs.map((d) => (
                <li key={d.title}>
                  <Link className={styles.doc} href="/contacts/">
                    <span
                      className={`${styles.docKind} ${
                        d.kind === "PDF" ? styles.docKindPdf : styles.docKindRu
                      }`}
                    >
                      {d.kind}
                    </span>
                    <span className={styles.docBody}>
                      <span className={styles.docTitle}>{d.title}</span>
                      <span className={styles.docNote}>{d.note}</span>
                    </span>
                    <span className={styles.docArrow} aria-hidden="true">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
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
