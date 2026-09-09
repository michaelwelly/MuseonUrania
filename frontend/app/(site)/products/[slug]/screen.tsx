import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { statusLabel } from "@/content/products";
import LeadForm from "@/components/LeadForm";
import { ui as strings } from "@/content/ui";
import { fetchDocuments, fetchProduct, fetchProducts } from "@/lib/api";
import { forProduct } from "@/lib/documents";
import ProductTabs from "./tabs";
import styles from "./page.module.css";
import { mediaSrc } from "@/lib/media";
import { pageMetadata } from "@/lib/seo";

// Карточка изделия. Тело вынесено из `page.tsx` в `screen.tsx`, потому что
// `screen.tsx` маршрутом не является: здесь можно держать любые экспорты
// и рисовать экран из тестов, чего `page.tsx` не позволяет.
//
// Слаг приходит уже разобранным: `params` — это дело маршрута, а не экрана.
//
// Почти всё на этой странице — тексты заказчика: описание, назначение,
// характеристики, статус документации. Они приходят из портала
// и из `content/products.ts`; экрану принадлежат только подписи
// разделов и кнопок.

export async function productMetadata(slug: string): Promise<Metadata> {
  const product = await fetchProduct(slug);
  if (!product) return {};
  // Адрес берётся из ответа API, а не из сегмента маршрута: canonical обязан
  // указывать на один адрес страницы, а прийти на неё можно и по кодировке,
  // отличной от каноничной.
  return pageMetadata({
    title: `${product.name} — ${product.kind} — VEDAL`,
    description: product.detail ?? product.summary,
    path: `/products/${product.slug}/`,
    image: product.image
      ? { url: mediaSrc(product.image.src), alt: product.image.alt }
      : undefined,
  });
}

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export default async function ProductScreen({ slug }: { slug: string }) {
  // Перечень документов читается тем же запросом, что и страница /documents/,
  // и с тем же сроком обновления: вкладка «Документы» карточки обязана
  // показывать то же самое, а не собственный список.
  const [product, products, documents] = await Promise.all([
    fetchProduct(slug),
    fetchProducts(),
    fetchDocuments(),
  ]);
  // Неопубликованное изделие бэкенд отдаёт как 404 — страницы у него нет.
  if (!product) notFound();

  const related = products.filter((p) => p.slug !== product.slug).slice(0, 3);

  return (
    <main className={styles.page}>
      <p className={styles.crumbs}>
        <Link href="/">{strings.crumbs.home}</Link> /{" "}
        <Link href="/products/">{strings.crumbs.products}</Link> /{" "}
        {/* Направление и название — из каталога заказчика, а не наши подписи. */}
        <span>{product.categories[0]}</span> /{" "}
        {product.name}
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
            <span>{strings.products.photoPending}</span>
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
            <span className={styles.cats}>
              {product.categories.map((cat) => cat).join(" · ")}
            </span>
          </div>

          <h1 className={styles.title} data-words="34" data-wdelay="110">
            {product.name}
          </h1>
          <p className={styles.kind}>
            {product.kind}
          </p>
          <p className={styles.detail}>
            {product.detail ?? product.summary}
          </p>

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

          {/* Кнопка ведёт на форму этой же страницы, а не на /contacts/.
              Раньше человек, решивший запросить КП на конкретном изделии,
              попадал на общие контакты и там заново выбирал тему и изделие —
              то есть вводил заново то, что уже выбрал, дойдя до карточки.

              Якорь, а не всплывающее окно и не переход с параметром:
              — окно требует ловушки фокуса, блокировки прокрутки и своего
                поведения на «назад», и ссылкой на него не поделишься;
              — переход вида `/contacts/?product=...` пришлось бы читать
                через `useSearchParams`, а он уводит страницу из статики,
                собираемой на сборке (см. components/Analytics.tsx), — и всё
                равно уносил бы человека с карточки, которую он читал.
              Ссылка `/products/<slug>/#quote` работает без JS, переживает
              пересылку и оставляет изделие перед глазами. */}
          <div className={styles.actions}>
            <a
              className={`${styles.btn} ${styles.btnPrimary}`}
              href="#quote"
              data-analytics="product_quote_click"
            >
              {strings.actions.requestQuote}
              <Arrow />
            </a>
          </div>

          {/* Обещать высылку регистрационного удостоверения нельзя: письмо
              заказчика от 10 августа 2026 — «удостоверение не выдаётся, есть
              только реестровая запись». Миграция V27 по этой причине перевела
              строки перечня в «Уточняется», а здесь то же обещание оставалось
              набранным руками. Состояние каждого документа видно на вкладке
              «Документы» ниже.

              Перевод абзаца согласовывает заказчик, а не мы: «регистрационное
              удостоверение» и «registration certificate» юридически не одно
              и то же. */}
          <p className={styles.note}>
            {PRODUCT_DOCS_NOTE}
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
          <h2 className={styles.aboutTitle}>{strings.product.purpose}</h2>
          {product.purpose ? (
            <p className={styles.aboutText}>
              {product.purpose}
            </p>
          ) : (
            // «Ожидает уточнения» — тоже утверждение о состоянии документов,
            // а не подпись интерфейса: оно называет, кто готовит текст и на
            // каком условии он появится.
            <p className={styles.awaiting}>
              {PURPOSE_AWAITING}
            </p>
          )}
        </div>

        <div>
          <h2 className={styles.aboutTitle}>{strings.product.features}</h2>
          {product.features ? (
            <ul className={styles.features}>
              {product.features.map((f) => (
                <li key={f}>
                  {f}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.awaiting}>
              {FEATURES_AWAITING}
            </p>
          )}
        </div>
      </section>

      <ProductTabs product={product} documents={forProduct(documents, product.slug)} />

      {/* Запрос КП — на самой карточке, сразу после характеристик и до
          «других продуктов»: человек дочитал, чем это изделие отличается,
          и следующий шаг должен быть здесь, а не на другой странице.

          Форма та же, что на /contacts/ (components/LeadForm), и уходит
          в ту же единственную дверь на запись — POST /api/forms/v1/leads.
          Отличий два: тема закреплена запросом КП, а изделие подставлено
          и не спрашивается. Слаг уезжает в `productSlug`, и менеджер видит
          в админке, по какому изделию оставлена заявка.

          Цель аналитики — `quote_form_submit`, как у формы контактов
          с выбранной темой «Запрос коммерческого предложения»: это одно
          и то же обращение, разведённое по страницам, а не два разных. */}
      <section className={styles.quote} id="quote">
        <div className={styles.quoteCard}>
          <h2 className={styles.quoteTitle} data-words="30">
            {strings.product.quoteTitle}
          </h2>
          <p className={styles.quoteText}>{strings.product.quoteText}</p>
          <LeadForm
            form="quote"
            product={{ slug: product.slug, name: product.name, kind: product.kind }}
            analytics="quote_form_submit"
            submitLabel={strings.actions.requestQuote}
          />
        </div>
      </section>

      <section className={styles.related}>
        <h2 className={styles.relatedTitle} data-words="34">
          {strings.product.other}
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

// Три абзаца ниже вынесены в константы, чтобы текст не был размазан по JSX
// переносами строк: так его видно целиком и правится он в одном месте.

/** Условия выдачи документации и статус регистрации. */
const PRODUCT_DOCS_NOTE =
  "Сертификаты и техническая документация выдаются по запросу, регистрационный статус — ожидает уточнения. Ведалина подберёт конфигурацию и пришлёт документы в чате.";

/** Назначения ещё нет: кто готовит текст и почему его пока не публикуют. */
const PURPOSE_AWAITING =
  "Назначение изделия — ожидает уточнения. Текст готовит производитель; до согласования формулировки на сайте не публикуются.";

/** Особенностей ещё нет: у кого запрошены и вместе с чем. */
const FEATURES_AWAITING =
  "Перечень особенностей — ожидает уточнения. Запрошен у производителя вместе с описаниями и характеристиками.";
