import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import TranslationNotice from "@/components/TranslationNotice";
import { privacy } from "@/content/legal";
import { ui } from "@/content/ui";
import { contentText } from "@/lib/content-i18n";
import { DEFAULT_LANG, localePath, type Lang } from "@/lib/i18n";
import styles from "./page.module.css";

// Персональные данные. Тело страницы вынесено из `page.tsx` сюда: его рисуют
// `/legal/privacy/` (русский, `app/(site)`) и `/[lang]/legal/privacy/`
// (переведённый, `app/(intl)`).
//
// Здесь нет ни одной строки, переведённой нами. Юридический текст в переводе —
// другая редакция документа: «регистрационное удостоверение» и «registration
// certificate» юридически не одно и то же. Поэтому весь текст, ссылки на закон
// и реквизиты оператора идут через `c.t` — то есть показываются по-русски,
// пока заказчик не согласует перевод. Нам принадлежат только хлебные крошки.
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

export function privacyMetadata(lang: Lang): Metadata {
  const c = contentText(lang);
  return {
    ...pageMetadata({
      // Название документа и его лид — часть самого документа, а не подпись
      // интерфейса: в заголовке вкладки они остаются русскими ровно до
      // согласованного перевода.
      title: `${c.t(privacy.title)} — VEDAL`,
      description: c.t(privacy.lead),
      path: "/legal/privacy/",
      lang,
    }),
    // Русская страница открыта поиску с 9 сентября 2026. До этого стоял
    // noindex, и причина была честная: по запросу «политика VEDAL» человек
    // нашёл бы сообщение о том, что документа нет. Теперь на странице сам
    // документ, и прятать его от того, кто его ищет, — ровно та же ошибка
    // наоборот.
    //
    // Переведённые версии остаются закрытыми: на них лежит русский оригинал
    // под английским и китайским адресом, и в выдаче он выглядел бы как
    // английская редакция политики, которой у компании нет.
    ...(lang === DEFAULT_LANG ? {} : { robots: { index: false, follow: true } }),
  };
}

export default function PrivacyScreen({ lang }: { lang: Lang }) {
  const strings = ui(lang);
  const c = contentText(lang);
  const at = (path: string) => localePath(lang, path);

  return (
    <main className={styles.page}>
      {/* Название документа пометить `lang="ru"` здесь нечем: `PageHero`
          принимает строки, а не разметку. Про то, на каком языке написан
          документ, говорит примечание сразу под первым экраном. */}
      <PageHero
        crumbs={[
          { label: strings.crumbs.home, href: at("/") },
          { label: strings.crumbs.privacy },
        ]}
        title={c.t(privacy.title)}
        lead={c.t(privacy.lead)}
        textLang={c.mark(privacy.title, privacy.lead)}
      />

      {/* Примечание в юридической редакции: на этой странице мало сказать
          «перевод не согласован» — нужно сказать, что перевод юридической
          силы не имеет. Для русской версии не рисуется. */}
      <TranslationNotice lang={lang} kind="legal" />

      {/* Шапка документа: редакция и файл. Стоит до содержания, потому что
          «какая это редакция» — первый вопрос к юридическому документу,
          а не примечание в конце. */}
      <section className={styles.docbar}>
        <p className={styles.revision} lang={c.mark(privacy.revisionLabel)}>
          {c.t(privacy.revisionLabel)}
        </p>
        {/* Файл собран печатью этой же страницы (scripts/privacy-pdf.sh),
            размер проставлен тем же скриптом. Ссылка ведёт на статический
            файл, поэтому это обычный <a>, а не next/link. */}
        <a className={styles.download} href={privacy.pdf.href} download>
          {c.t(privacy.pdf.label)}
          <span className={styles.size}>{privacy.pdf.size}</span>
        </a>
      </section>

      {/* Оглавление. Для документа в четырнадцать разделов это не украшение:
          человек приходит сюда за одним вопросом — «как удалить мои данные» —
          и должен попасть в нужный раздел, а не листать до него. */}
      <nav className={styles.toc} aria-label={c.t(privacy.tocTitle)}>
        <h2 className={styles.tocTitle} lang={c.mark(privacy.tocTitle)}>
          {c.t(privacy.tocTitle)}
        </h2>
        <ol className={styles.tocList}>
          {privacy.sections.map((section, i) => (
            <li key={section.id}>
              <a href={`#${section.id}`} lang={c.mark(section.title)}>
                <span className={styles.tocNum} aria-hidden="true">
                  {i + 1}
                </span>
                {c.t(section.title)}
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
          <h2 id={section.id} className={styles.h2} lang={c.mark(section.title)}>
            <span className={styles.num} aria-hidden="true">
              {i + 1}
            </span>
            {c.t(section.title)}
          </h2>

          {section.text && (
            <p className={styles.text} lang={c.mark(section.text)}>
              {c.t(section.text)}
            </p>
          )}

          {section.rows && (
            <dl className={styles.table}>
              {section.rows.map((row) => (
                <div key={row.label} className={styles.row} lang={c.mark(row.label, row.value)}>
                  <dt className={styles.rowLabel}>{c.t(row.label)}</dt>
                  <dd>{c.t(row.value)}</dd>
                </div>
              ))}
            </dl>
          )}

          {section.items && (
            <ul className={styles.list}>
              {section.items.map((item) => (
                <li key={item} lang={c.mark(item)}>
                  {c.t(item)}
                </li>
              ))}
            </ul>
          )}

          {section.links && (
            <ul className={styles.links}>
              {/* Подписи ссылок называют закон и того, кто его публикует.
                  Сами ссылки ведут на русские официальные тексты — переводить
                  подпись, оставив адрес, значит обещать перевод по ссылке. */}
              {section.links.map((link) => (
                <li key={link.href} lang={c.mark(link.label)}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer">
                    {c.t(link.label)}
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
