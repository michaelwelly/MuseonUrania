"use client";

import { useState } from "react";
import Image from "next/image";
import { categories, products, statusLabel, type Category } from "@/content/products";
import { hero } from "@/content/site";
import styles from "./page.module.css";

// Фильтр по категориям из docs/frontend/page_briefs.md → Products.
// Фильтрация на клиенте: каталог небольшой, перезагрузка страницы ради
// смены категории тут только мешала бы.
export default function Catalog() {
  const [active, setActive] = useState<Category | null>(null);
  const shown = active ? products.filter((p) => p.categories.includes(active)) : products;

  return (
    <>
      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.filter} ${active === null ? styles.filterActive : ""}`}
          onClick={() => setActive(null)}
          aria-pressed={active === null}
        >
          Все
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.filter} ${active === c ? styles.filterActive : ""}`}
            onClick={() => setActive(c)}
            aria-pressed={active === c}
          >
            {c}
          </button>
        ))}
      </div>

      <p className={styles.count} aria-live="polite">
        Показано {shown.length} из {products.length}
      </p>

      {shown.length === 0 ? (
        <p className={styles.empty}>В этой категории пока нет позиций.</p>
      ) : (
        <ul className={styles.grid}>
          {shown.map((p) => (
            <li key={p.slug} className={styles.card}>
              <div className={`${styles.thumb} ${p.image ? "" : styles.thumbEmpty}`}>
                {p.image ? (
                  <Image
                    src={p.image.src}
                    alt={p.image.alt}
                    fill
                    sizes="(max-width: 560px) 100vw, 320px"
                  />
                ) : (
                  <span>Фото ожидает уточнения</span>
                )}
              </div>

              <div className={styles.body}>
                <h3 className={styles.name}>{p.name}</h3>
                <p className={styles.kind}>{p.kind}</p>
                <p className={styles.summary}>{p.summary}</p>

                <ul className={styles.tags}>
                  {p.categories.map((c) => (
                    <li key={c} className={styles.tag}>
                      {c}
                    </li>
                  ))}
                </ul>

                <p
                  className={`${styles.status} ${
                    p.status === "confirmed" ? styles.statusConfirmed : styles.statusPending
                  }`}
                >
                  {statusLabel[p.status]}
                </p>

                <div className={styles.cardActions}>
                  <a
                    className={styles.smallButton}
                    href={hero.primaryCta.href}
                    data-analytics="product_quote_click"
                  >
                    Запросить КП
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
