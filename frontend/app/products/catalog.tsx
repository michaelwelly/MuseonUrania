"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { categories, products, statusLabel, type Category } from "@/content/products";
import styles from "./page.module.css";

// Фильтр и сортировка на клиенте: позиций мало, перезагрузка страницы ради
// смены категории только мешала бы.
export default function Catalog() {
  const [active, setActive] = useState<Category | null>(null);
  const [docsFirst, setDocsFirst] = useState(false);

  const filtered = active ? products.filter((p) => p.categories.includes(active)) : products;
  const shown = docsFirst
    ? [...filtered].sort((a, b) => Number(b.status === "confirmed") - Number(a.status === "confirmed"))
    : filtered;

  return (
    <>
      <div className={styles.filters}>
        <div className={styles.chips}>
          <button
            type="button"
            className={`${styles.chip} ${active === null ? styles.chipActive : ""}`}
            onClick={() => setActive(null)}
            aria-pressed={active === null}
          >
            Все
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.chip} ${active === c ? styles.chipActive : ""}`}
              onClick={() => setActive(c)}
              aria-pressed={active === c}
            >
              {c}
            </button>
          ))}
        </div>

        <div className={styles.meta}>
          <span aria-live="polite">
            Показано {shown.length} из {products.length}
          </span>
          <button
            type="button"
            className={`${styles.sort} ${docsFirst ? styles.sortActive : ""}`}
            onClick={() => setDocsFirst((v) => !v)}
            aria-pressed={docsFirst}
          >
            Сначала с документацией
            <svg width="11" height="7" viewBox="0 0 12 8" fill="none" aria-hidden="true">
              <path d="M1 1.5 6 6.5l5-5" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </div>
      </div>

      <ul className={styles.grid}>
        {shown.length === 0 && <li className={styles.empty}>В этой категории пока нет позиций.</li>}

        {shown.map((p) => (
          <li key={p.slug}>
            <Link
              className={styles.card}
              href={`/products/${p.slug}/`}
              data-analytics="product_card_open"
            >
              <div className={`${styles.photo} ${p.image ? "" : styles.photoEmpty}`}>
                {p.image ? (
                  <Image
                    src={p.image.src}
                    alt={p.image.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
                  />
                ) : (
                  <span>Фото ожидает съёмки</span>
                )}
              </div>

              <div className={styles.body}>
                <p className={styles.cat}>{p.categories[0]}</p>
                <h3 className={styles.name}>{p.name}</h3>
                <p className={styles.kind}>{p.kind}</p>
                <p className={styles.summary}>{p.summary}</p>
                <span
                  className={`${styles.badge} ${
                    p.status === "confirmed" ? styles.badgeOk : styles.badgeMuted
                  }`}
                >
                  {statusLabel[p.status]}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
