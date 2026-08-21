import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { statusLabel } from "@/content/products";
import { fetchProduct, fetchProducts } from "@/lib/api";
import ProductTabs from "./tabs";
import styles from "./page.module.css";
import { mediaSrc } from "@/lib/media";
import { pageMetadata } from "@/lib/seo";

export async function generateStaticParams() {
  const products = await fetchProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await fetchProduct(slug);
  if (!product) return {};
  // Адрес берётся из ответа API, а не из сегмента маршрута: canonical обязан
  // указывать на один адрес страницы, а прийти на неё можно и по кодировке,
  // отличной от каноничной.
  return pageMetadata({
    title: `${product.name} — ${product.kind} — VEDAL`,
    description: product.detail ?? product.summary,
    path: `/products/${product.slug}/`,
    image: product.image ? { url: mediaSrc(product.image.src), alt: product.image.alt } : undefined,
  });
}

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export default async function ProductPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const [product, products] = await Promise.all([fetchProduct(slug), fetchProducts()]);
  // Неопубликованное изделие бэкенд отдаёт как 404 — страницы у него нет.
  if (!product) notFound();

  const related = products.filter((p) => p.slug !== product.slug).slice(0, 3);

  return (
    <main className={styles.page}>
      <p className={styles.crumbs}>
        <Link href="/">Главная</Link> / <Link href="/products/">Продукция</Link> /{" "}
        {product.categories[0]} / {product.name}
      </p>

      <section className={styles.main}>
        <div
          className={`${styles.photo} ${product.image ? "" : styles.photoEmpty}`}
          data-anim="clip"
        >
          {product.image ? (
            <Image
              src={mediaSrc(product.image.src)}
              alt={product.image.alt}
              fill
              sizes="(max-width: 1100px) 100vw, 50vw"
              priority
            />
          ) : (
            <span>Фото ожидает съёмки</span>
          )}
        </div>

        <div className={styles.info}>
          <div className={styles.infoTop}>
            <span
              className={`${styles.badge} ${
                product.status === "confirmed" ? styles.badgeOk : styles.badgeMuted
              }`}
            >
              {statusLabel[product.status]}
            </span>
            <span className={styles.cats}>{product.categories.join(" · ")}</span>
          </div>

          <h1 className={styles.title} data-words="34" data-wdelay="110">
            {product.name}
          </h1>
          <p className={styles.kind}>{product.kind}</p>
          <p className={styles.detail}>{product.detail ?? product.summary}</p>

          {product.keyParams && (
            <ul className={styles.params}>
              {product.keyParams.map((p) => (
                <li key={p.label} className={styles.param}>
                  <span className={styles.paramLabel}>{p.label}</span>
                  <span>{p.value}</span>
                </li>
              ))}
            </ul>
          )}

          <div className={styles.actions}>
            <Link
              className={`${styles.btn} ${styles.btnPrimary}`}
              href="/contacts/"
              data-analytics="product_quote_click"
            >
              Запросить КП
              <Arrow />
            </Link>
          </div>

          <p className={styles.note}>
            Регистрационное удостоверение и сертификаты выдаются по запросу. Ведалина подберёт
            конфигурацию и пришлёт документы в чате.
          </p>
        </div>
      </section>

      {/* §4.5 плана: места под назначение и ключевые особенности. Оба блока
          стоят до вкладок намеренно — это ответ на вопрос «что это и зачем»,
          а вкладки ниже отвечают на «сколько весит и что в комплекте».
          Прятать назначение за вкладку значит просить читателя догадаться,
          что искать его надо в «Характеристиках».

          Пустые блоки не скрываются: §4.7 ждёт тексты от НН, и видимое
          «ожидает уточнения» — это напоминание, а скрытый блок — забытая
          задача. Правило CLAUDE.md запрещает заполнять такие места
          правдоподобной выдумкой. */}
      <section className={styles.about}>
        <div>
          <h2 className={styles.aboutTitle}>Назначение</h2>
          {product.purpose ? (
            <p className={styles.aboutText}>{product.purpose}</p>
          ) : (
            <p className={styles.awaiting}>
              Назначение изделия — ожидает уточнения. Текст готовит производитель; до
              согласования формулировки на сайте не публикуются.
            </p>
          )}
        </div>

        <div>
          <h2 className={styles.aboutTitle}>Ключевые особенности</h2>
          {product.features ? (
            <ul className={styles.features}>
              {product.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.awaiting}>
              Перечень особенностей — ожидает уточнения. Запрошен у производителя вместе с
              описаниями и характеристиками.
            </p>
          )}
        </div>
      </section>

      <ProductTabs product={product} />

      <section className={styles.related}>
        <h2 className={styles.relatedTitle} data-words="34">
          Другие продукты
        </h2>
        <ul className={styles.relatedGrid}>
          {related.map((p, i) => (
            <li key={p.slug} data-reveal={i}>
              <Link className={styles.card} href={`/products/${p.slug}/`}>
                <div className={styles.cardPhoto}>
                  {p.image && (
                    <Image
                      src={mediaSrc(p.image.src)}
                      alt={p.image.alt}
                      fill
                      sizes="(max-width: 1100px) 50vw, 33vw"
                    />
                  )}
                </div>
                <div className={styles.cardBody}>
                  <p className={styles.cardCat}>{p.categories[0]}</p>
                  <h3 className={styles.cardName}>{p.name}</h3>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
