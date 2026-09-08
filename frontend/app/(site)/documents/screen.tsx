import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import TranslationNotice from "@/components/TranslationNotice";
import { documentsHero, order, request } from "@/content/documents";
import { companyContact, STAFF_AWAITING } from "@/content/staff";
import { ui } from "@/content/ui";
import { vedalina } from "@/content/vedalina";
import { fetchDocuments } from "@/lib/api";
import { isOpen } from "@/lib/documents";
import { contentText } from "@/lib/content-i18n";
import { localePath, type Lang } from "@/lib/i18n";
import DocumentsTable from "./table";
import styles from "./page.module.css";

// Документы. Тело страницы вынесено из `page.tsx` в `screen.tsx`, потому что
// его рисуют два маршрута: `/documents/` (русский, `app/(site)`) и
// `/[lang]/documents/` (переведённый, `app/(intl)`). Файл `screen.tsx`
// маршрутом не является, поэтому здесь можно держать любые экспорты.
//
// Названия документов, их статусы и порядок публикации переводит заказчик:
// «регистрационное удостоверение» и «registration certificate» юридически
// не одно и то же. Всё содержательное идёт через `contentText`, интерфейс —
// из `content/ui.ts`.

export function documentsMetadata(lang: Lang): Metadata {
  const strings = ui(lang);
  const c = contentText(lang);
  return pageMetadata({
    title: strings.meta.documents,
    // Описание страницы — тот же лид, что и в первом экране: своего
    // переведённого описания у раздела нет, а выдумывать его нельзя.
    description: c.t(documentsHero.lead),
    path: "/documents/",
    lang,
  });
}

export default async function DocumentsScreen({ lang }: { lang: Lang }) {
  const documents = await fetchDocuments();

  // Подпись под легендой не должна утверждать, что файлов нет, когда они
  // есть. Считаем по самому перечню: редактор выкладывает файл через
  // админку и не открывает при этом content/documents.ts.
  const anyOpen = documents.some(isOpen);
  const strings = ui(lang);
  const c = contentText(lang);
  const at = (path: string) => localePath(lang, path);

  return (
    <main className={styles.page}>
      <PageHero
        crumbs={[{ label: strings.crumbs.home, href: at("/") }, { label: strings.crumbs.documents }]}
        title={c.t(documentsHero.title)}
        lead={c.t(documentsHero.lead)}
        textLang={c.mark(documentsHero.title, documentsHero.lead)}
        aside={
          <Link className={styles.heroBtn} href={at("/contacts/")}>
            {strings.actions.requestDocument}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M2 8h11M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="square"
              />
            </svg>
          </Link>
        }
      />

      {/* Примечание о непереведённом стоит сразу после первого экрана:
          ниже идут названия документов и их статусы, а их перевод
          согласовывает заказчик. Для русской версии не рисуется. */}
      <TranslationNotice lang={lang} />

      <DocumentsTable documents={documents} lang={lang} />

      <section className={styles.order}>
        <div data-reveal="0">
          <p className={styles.eyebrow} lang={c.mark(order.eyebrow)}>
            {c.t(order.eyebrow)}
          </p>
          <h2 className={styles.h2} data-words="30" lang={c.mark(order.title)}>
            {c.t(order.title)}
          </h2>
          <p className={styles.orderText} lang={c.mark(order.text)}>
            {c.t(order.text)}
          </p>

          <ul className={styles.legend}>
            {order.legend.map((l) => (
              // Ярлык доступа и пояснение к нему — утверждение о том, как
              // документ выдают. Помечаем строку разом: если хоть одна
              // половина осталась оригиналом, русская вся строка.
              <li key={l.badge} className={styles.legendRow} lang={c.mark(l.badge, l.text)}>
                <span
                  className={`${styles.legendBadge} ${
                    // Зелёный — только у выложенного файла. «По запросу»
                    // и «Уточняется» одинаково означают, что файла нет.
                    //
                    // Сравнивается русский оригинал, а не показанный текст:
                    // цвет ярлыка выбирает статус, и после перевода
                    // сравнение с «Файл» перестало бы совпадать.
                    l.badge === "Файл" ? styles.badgeOk : styles.badgeMuted
                  }`}
                >
                  {c.t(l.badge)}
                </span>
                {c.t(l.text)}
              </li>
            ))}
          </ul>

          <p className={styles.note} lang={c.mark(anyOpen ? order.notes.some : order.notes.none)}>
            {c.t(anyOpen ? order.notes.some : order.notes.none)}
          </p>
        </div>

        <div className={styles.request} data-reveal="1">
          <h2 className={styles.requestTitle} data-words="30" lang={c.mark(request.title)}>
            {c.t(request.title)}
          </h2>
          <p className={styles.requestText} lang={c.mark(request.text)}>
            {c.t(request.text)}
          </p>

          <div className={styles.contact}>
            <div className={styles.avatar}>
              <Image src={vedalina.avatar} alt="" width={34} height={34} />
            </div>
            <div>
              {/* Название юрлица и круг задач специалиста — содержательный
                  текст: и то и другое утверждает что-то о компании. Адрес
                  почты не переводится ни на одном языке. */}
              <p className={styles.contactName} lang={c.mark(companyContact.title)}>
                {c.t(companyContact.title)}
              </p>
              <p className={styles.contactRole} lang={c.mark(companyContact.scope)}>
                {c.t(companyContact.scope)} ·{" "}
                <a href={`mailto:${companyContact.email}`}>{companyContact.email}</a>
              </p>
            </div>
          </div>
          {/* Контакт — заглушка из макета, см. content/staff.ts */}
          <p className={styles.demoNote} lang={c.mark(STAFF_AWAITING)}>
            {c.t(STAFF_AWAITING)}
          </p>
        </div>
      </section>
    </main>
  );
}
