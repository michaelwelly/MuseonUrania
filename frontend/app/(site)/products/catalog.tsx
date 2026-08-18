"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { statusLabel } from "@/content/products";
import type { Product } from "@/lib/api";
import styles from "./page.module.css";
import { mediaSrc } from "@/lib/media";

type Props = { products: Product[]; categories: string[] };

// Фильтр на клиенте: позиций мало, перезагрузка страницы ради смены категории
// только мешала бы. Сами позиции приходят сверху — их читает серверный
// компонент на сборке.
//
// Сортировка «сначала с документацией» убрана 19 августа. Она решала задачу
// каталога на двенадцать позиций: там имело смысл поднять наверх те, у которых
// датащит подтверждён. В каталоге первого релиза позиций четыре, все четыре
// с подтверждённой документацией, и кнопка не меняла ни одной строки на
// экране. Порядок вывода задан заказчиком в §3.2 и живёт в sort_order —
// переключатель, способный его переставить, этому прямо противоречит.
export default function Catalog({ products, categories }: Props) {
  const [active, setActive] = useState<string | null>(null);

  const shown = active ? products.filter((p) => p.categories.includes(active)) : products;

  return (
    <>
      {/* Ревил на контейнерах, а не на карточках: сетка перерисовывается при
          смене фильтра, и карточка с ещё не снятым inline-стилем осталась бы
          невидимой до следующего скролла. */}
      <div className={styles.filters} data-reveal="0">
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
        </div>
      </div>

      <ul className={styles.grid} data-reveal="1">
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
                    src={mediaSrc(p.image.src)}
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
