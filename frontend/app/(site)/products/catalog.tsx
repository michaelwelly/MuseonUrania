import Image from "next/image";
import Link from "next/link";
import { statusLabel } from "@/content/products";
import { ui as strings } from "@/content/ui";
import type { Product } from "@/lib/api";
import styles from "./page.module.css";
import { mediaSrc } from "@/lib/media";

type Props = { products: Product[] };

// Каталог первого релиза выводится списком, без фильтров и сортировки.
//
// Убрано 19 августа по прямому решению заказчика. Обе механики родом из
// каталога на двенадцать позиций: там фильтр по направлению экономил
// прокрутку, а сортировка поднимала наверх позиции с подтверждённым
// датащитом. На четырёх изделиях фильтр показывает четыре из четырёх,
// а два направления из пяти открываются в пустоту.
//
// Заодно компонент перестал быть клиентским: состояния в нём не осталось,
// а с ним ушли useState, гидратация и сам JS этой страницы в браузере.
// Ревилы держатся на data-атрибутах и работают без него.
export default function Catalog({ products }: Props) {
  return (
    <>
      {/* GitHub issue #80: у каталога не было своего уровня заголовка —
          h1 страницы шёл сразу в h3 карточек. Заголовок нужен для структуры
          документа, но не по макету: раздел не должен обзаводиться видимой
          подписью, которой не было в согласованной вёрстке. */}
      <h2 className={styles.catalogHeading}>{strings.products.listHeading}</h2>
      <ul className={styles.grid} data-reveal="0">
        {products.map((p) => (
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
                  <span>{strings.products.photoPending}</span>
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
