import Image from "next/image";
import Link from "next/link";
import { statusLabel } from "@/content/products";
import { ui } from "@/content/ui";
import type { Product } from "@/lib/api";
import { contentText } from "@/lib/content-i18n";
import { localePath, type Lang } from "@/lib/i18n";
import styles from "./page.module.css";
import { mediaSrc } from "@/lib/media";

type Props = { products: Product[]; lang: Lang };

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
//
// Язык приходит пропом, а не из хука: страница серверная, и на клиенте
// этому компоненту делать нечего. Подписи каталога — наши, а направление,
// название, тип и описание изделия правит заказчик, поэтому они идут
// через `contentText` и остаются русскими, пока перевод не согласован.
export default function Catalog({ products, lang }: Props) {
  const strings = ui(lang);
  const c = contentText(lang);
  const at = (path: string) => localePath(lang, path);

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
              href={at(`/products/${p.slug}/`)}
              data-analytics="product_card_open"
            >
              <div className={`${styles.photo} ${p.image ? "" : styles.photoEmpty}`}>
                {p.image ? (
                  <Image
                    src={mediaSrc(p.image.src)}
                    alt={c.t(p.image.alt)}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
                  />
                ) : (
                  <span>{strings.products.photoPending}</span>
                )}
              </div>

              {/* Направление, тип и краткое описание — тексты заказчика.
                  Помечаем весь блок разом: если хоть одна строка осталась
                  оригиналом, блок читается как русский. Название изделия
                  не переводится ни на одном языке — это имя модели. */}
              <div className={styles.body} lang={c.mark(p.categories[0], p.kind, p.summary)}>
                <p className={styles.cat}>{c.t(p.categories[0])}</p>
                <h3 className={styles.name}>{p.name}</h3>
                <p className={styles.kind}>{c.t(p.kind)}</p>
                <p className={styles.summary}>{c.t(p.summary)}</p>
                {/* Статус документации — утверждение о разрешительных
                    документах, а не состояние интерфейса: выдумывать его
                    перевод правила контента запрещают. */}
                <span
                  className={`${styles.badge} ${
                    p.status === "confirmed" ? styles.badgeOk : styles.badgeMuted
                  }`}
                  lang={c.mark(statusLabel[p.status])}
                >
                  {c.t(statusLabel[p.status])}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
