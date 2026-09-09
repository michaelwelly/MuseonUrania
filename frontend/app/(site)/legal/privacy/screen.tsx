import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { privacy } from "@/content/legal";
import { ui as strings } from "@/content/ui";
import styles from "./page.module.css";

// Персональные данные. Тело страницы вынесено из `page.tsx` сюда, потому что
// `screen.tsx` маршрутом не является: здесь можно держать любые экспорты
// и рисовать экран из тестов, чего `page.tsx` не позволяет.
//
// Ни одной строки документа экран не сочиняет: текст, ссылки на закон
// и реквизиты оператора лежат в `content/legal.ts` и правятся вместе
// с самим документом. Экрану принадлежат только хлебные крошки.
//
// ————— почему разделы рисуются одним циклом —————
//
// Раньше у каждого раздела был свой кусок разметки. Пока разделов было пять,
// это читалось; для документа из четырнадцати разделов такая разметка значит,
// что новый раздел добавляется в двух местах — в тексте и в вёрстке, — и
// забытая половина обнаруживается тем, что раздела нет на странице.
//
// Теперь состав документа целиком описан в `content/legal.ts`, а экран знает
// только про четыре способа наполнить раздел: абзац, список, таблица
// реквизитов и ссылки. Оглавление строится по тому же массиву, поэтому пункт
// оглавления не может указать на несуществующий якорь.

export function privacyMetadata(): Metadata {
  return {
    ...pageMetadata({
      // Название документа и его лид — часть самого документа, а не подпись
      // интерфейса: в заголовок вкладки они едут как есть.
      title: `${privacy.title} — VEDAL`,
      description: privacy.lead,
      path: "/legal/privacy/",
    }),
    // Русская страница открыта поиску с 9 сентября 2026. До этого стоял
    // noindex, и причина была честная: по запросу «политика VEDAL» человек
    // нашёл бы сообщение о том, что документа нет. Теперь на странице сам
    // документ, и прятать его от того, кто его ищет, — ровно та же ошибка
    // наоборот.
  };
}

export default function PrivacyScreen() {
  return (
    <main className={styles.page}>
      <PageHero
        crumbs={[
          { label: strings.crumbs.home, href: "/" },
          { label: strings.crumbs.privacy },
        ]}
        title={privacy.title}
        lead={privacy.lead}
      />

      {/* Шапка документа: редакция и файл. Стоит до содержания, потому что
          «какая это редакция» — первый вопрос к юридическому документу,
          а не примечание в конце. */}
      <section className={styles.docbar}>
        <p className={styles.revision}>
          {privacy.revisionLabel}
        </p>
        {/* Файл собран печатью этой же страницы (scripts/privacy-pdf.sh),
            размер проставлен тем же скриптом. Ссылка ведёт на статический
            файл, поэтому это обычный <a>, а не next/link. */}
        <a className={styles.download} href={privacy.pdf.href} download>
          {privacy.pdf.label}
          <span className={styles.size}>{privacy.pdf.size}</span>
        </a>
      </section>

      {/* Оглавление. Для документа в четырнадцать разделов это не украшение:
          человек приходит сюда за одним вопросом — «как удалить мои данные» —
          и должен попасть в нужный раздел, а не листать до него. */}
      <nav className={styles.toc} aria-label={privacy.tocTitle}>
        <h2 className={styles.tocTitle}>
          {privacy.tocTitle}
        </h2>
        <ol className={styles.tocList}>
          {privacy.sections.map((section, i) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>
                <span className={styles.tocNum} aria-hidden="true">
                  {i + 1}
                </span>
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {privacy.sections.map((section, i) => (
        // Полосы чередуются, чтобы в длинном документе было видно границу
        // раздела: четырнадцать одинаковых блоков подряд сливаются в стену.
        <section
          key={section.id}
          className={i % 2 === 1 ? styles.sectionSoft : styles.section}
          aria-labelledby={section.id}
        >
          {/* Якорь висит на заголовке, а не на секции: у секции он оказался бы
              под липкой шапкой сайта, и переход из оглавления показывал бы
              текст со срезанным заголовком. Отступ добавлен в стилях. */}
          <h2 id={section.id} className={styles.h2}>
            <span className={styles.num} aria-hidden="true">
              {i + 1}
            </span>
            {section.title}
          </h2>

          {section.text && (
            <p className={styles.text}>
              {section.text}
            </p>
          )}

          {section.rows && (
            <dl className={styles.table}>
              {section.rows.map((row) => (
                <div key={row.label} className={styles.row}>
                  <dt className={styles.rowLabel}>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {section.items && (
            <ul className={styles.list}>
              {section.items.map((item) => (
                <li key={item}>
                  {item}
                </li>
              ))}
            </ul>
          )}

          {section.links && (
            <ul className={styles.links}>
              {section.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}

          {section.contacts && (
            <address className={styles.contacts}>
              <a href={`tel:${section.contacts.phone.replace(/\s/g, "")}`}>
                {section.contacts.phone}
              </a>
              <a href={`mailto:${section.contacts.email}`}>{section.contacts.email}</a>
            </address>
          )}
        </section>
      ))}
    </main>
  );
}
