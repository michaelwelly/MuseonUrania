import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import TranslationNotice from "@/components/TranslationNotice";
import { privacy } from "@/content/legal";
import { ui } from "@/content/ui";
import { contentText } from "@/lib/content-i18n";
import { localePath, type Lang } from "@/lib/i18n";
import styles from "./page.module.css";

// Персональные данные. Тело страницы вынесено из `page.tsx` сюда: его рисуют
// `/legal/privacy/` (русский, `app/(site)`) и `/[lang]/legal/privacy/`
// (переведённый, `app/(intl)`).
//
// Здесь нет ни одной строки, переведённой нами. Юридический текст в переводе —
// другая редакция документа: «регистрационное удостоверение» и «registration
// certificate» юридически не одно и то же, а перевод статуса «ожидает
// уточнения» читается как обещание. Поэтому весь текст, ссылки на закон и
// реквизиты оператора идут через `c.t` — то есть показываются по-русски,
// пока заказчик не согласует перевод. Нам принадлежат только хлебные крошки.

export function privacyMetadata(lang: Lang): Metadata {
  const c = contentText(lang);
  return {
    ...pageMetadata({
      // Название документа и его статус — часть самого документа, а не
      // подпись интерфейса: в заголовке вкладки они остаются русскими
      // ровно до согласованного перевода.
      title: `${c.t(privacy.title)} — VEDAL`,
      description: c.t(privacy.lead),
      path: "/legal/privacy/",
      lang,
    }),
    // Страница со статусом «готовится» не должна попасть в поиск: по запросу
    // «политика VEDAL» человек должен найти документ, а не сообщение о том,
    // что документа пока нет. Снимем, когда появится согласованный текст.
    //
    // canonical при этом остаётся: noindex говорит «не показывать в выдаче»,
    // а canonical — «вот основной адрес этой страницы». Второе нужно и здесь:
    // ссылку на политику ставят из подвала каждой страницы, и адрес у неё
    // должен быть один, а не три по числу хостов.
    //
    // Языковые версии закрыты от индексации по той же причине, что и русская,
    // и вдобавок по своей: на них лежит русский оригинал под английским
    // и китайским адресом.
    robots: { index: false, follow: true },
  };
}

export default function PrivacyScreen({ lang }: { lang: Lang }) {
  const strings = ui(lang);
  const c = contentText(lang);
  const at = (path: string) => localePath(lang, path);

  return (
    <main className={styles.page}>
      {/* Название документа и его статус пометить `lang="ru"` здесь нечем:
          `PageHero` принимает строки, а не разметку. Про то, на каком языке
          написан документ, говорит примечание сразу под первым экраном. */}
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

      <section className={styles.section}>
        <h2 className={styles.h2} lang={c.mark(privacy.law.title)}>
          {c.t(privacy.law.title)}
        </h2>
        <p className={styles.text} lang={c.mark(privacy.law.text)}>
          {c.t(privacy.law.text)}
        </p>
        <ul className={styles.links}>
          {/* Подписи ссылок называют закон и орган, который его публикует.
              Сами ссылки ведут на русские официальные тексты — переводить
              подпись, оставив адрес, значит обещать перевод по ссылке. */}
          {privacy.law.links.map((link) => (
            <li key={link.href} lang={c.mark(link.label)}>
              <a href={link.href} target="_blank" rel="noopener noreferrer">
                {c.t(link.label)}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.sectionSoft}>
        <h2 className={styles.h2} lang={c.mark(privacy.operator.title)}>
          {c.t(privacy.operator.title)}
        </h2>
        <dl className={styles.table}>
          {/* Реквизиты оператора: наименование общества, ИНН, КПП, адрес.
              Ни одной строки не переводим сами. */}
          {privacy.operator.rows.map((row) => (
            <div key={row.label} className={styles.row} lang={c.mark(row.label, row.value)}>
              <dt className={styles.rowLabel}>{c.t(row.label)}</dt>
              <dd>{c.t(row.value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Состав собираемых данных стоит выше «что действует сейчас»: человек
          сначала должен узнать, что именно с него берут, и только потом —
          какие правила пока действуют. */}
      <section className={styles.section}>
        <h2 className={styles.h2} lang={c.mark(privacy.collected.title)}>
          {c.t(privacy.collected.title)}
        </h2>
        <p className={styles.text} lang={c.mark(privacy.collected.text)}>
          {c.t(privacy.collected.text)}
        </p>
        <ul className={styles.list}>
          {privacy.collected.items.map((item) => (
            <li key={item} lang={c.mark(item)}>
              {c.t(item)}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2} lang={c.mark(privacy.current.title)}>
          {c.t(privacy.current.title)}
        </h2>
        <ul className={styles.list}>
          {privacy.current.items.map((item) => (
            <li key={item} lang={c.mark(item)}>
              {c.t(item)}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.sectionSoft}>
        <h2 className={styles.h2} lang={c.mark(privacy.scope.title)}>
          {c.t(privacy.scope.title)}
        </h2>
        <ol className={styles.numbered}>
          {privacy.scope.items.map((item) => (
            <li key={item} lang={c.mark(item)}>
              {c.t(item)}
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2} lang={c.mark(privacy.contact.title)}>
          {c.t(privacy.contact.title)}
        </h2>
        <p className={styles.text} lang={c.mark(privacy.contact.text)}>
          {c.t(privacy.contact.text)}
        </p>
        <address className={styles.contacts}>
          <a href={`tel:${privacy.contact.phone.replace(/\s/g, "")}`}>{privacy.contact.phone}</a>
          <a href={`mailto:${privacy.contact.email}`}>{privacy.contact.email}</a>
        </address>
      </section>
    </main>
  );
}
