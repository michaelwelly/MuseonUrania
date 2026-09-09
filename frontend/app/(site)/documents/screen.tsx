import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { documentsHero, order, request } from "@/content/documents";
import { companyContact } from "@/content/staff";
import { ui as strings } from "@/content/ui";
import { vedalina } from "@/content/vedalina";
import { fetchDocuments } from "@/lib/api";
import { REQUEST_HREF, isOpen } from "@/lib/documents";
import DocumentsTable from "./table";
import styles from "./page.module.css";

// Документы. Тело страницы вынесено из `page.tsx` в `screen.tsx`, потому что
// `screen.tsx` маршрутом не является: здесь можно держать любые экспорты
// и рисовать экран из тестов, чего `page.tsx` не позволяет.
//
// Названия документов, их статусы и порядок публикации задаёт заказчик:
// они приходят из портала и из `content/documents.ts`. Экрану принадлежат
// только подписи интерфейса из `content/ui.ts`.

export function documentsMetadata(): Metadata {
  return pageMetadata({
    title: strings.meta.documents,
    // Описание страницы — тот же лид, что и в первом экране: отдельного
    // описания у раздела нет, а выдумывать его нельзя.
    description: documentsHero.lead,
    path: "/documents/",
  });
}

export default async function DocumentsScreen() {
  const documents = await fetchDocuments();

  // Подпись под легендой не должна утверждать, что файлов нет, когда они
  // есть. Считаем по самому перечню: редактор выкладывает файл через
  // админку и не открывает при этом content/documents.ts.
  const anyOpen = documents.some(isOpen);

  return (
    <main className={styles.page}>
      {/* Кнопка в первом экране приводит в форму с уже выбранной темой
          запроса документа, а не на верх страницы контактов: адрес собран
          в lib/documents вместе с правилом для строк перечня ниже. */}
      <PageHero
        crumbs={[{ label: strings.crumbs.home, href: "/" }, { label: strings.crumbs.documents }]}
        title={documentsHero.title}
        lead={documentsHero.lead}
        aside={
          <Link className={styles.heroBtn} href={REQUEST_HREF}>
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

      <DocumentsTable documents={documents} />

      <section className={styles.order}>
        <div data-reveal="0">
          <p className={styles.eyebrow}>
            {order.eyebrow}
          </p>
          <h2 className={styles.h2} data-words="30">
            {order.title}
          </h2>
          <p className={styles.orderText}>
            {order.text}
          </p>

          <ul className={styles.legend}>
            {order.legend.map((l) => (
              <li key={l.badge} className={styles.legendRow}>
                <span
                  className={`${styles.legendBadge} ${
                    // Зелёный — только у выложенного файла. «По запросу»
                    // и «Уточняется» одинаково означают, что файла нет.
                    l.badge === "Файл" ? styles.badgeOk : styles.badgeMuted
                  }`}
                >
                  {l.badge}
                </span>
                {l.text}
              </li>
            ))}
          </ul>

          <p className={styles.note}>
            {anyOpen ? order.notes.some : order.notes.none}
          </p>
        </div>

        <div className={styles.request} data-reveal="1">
          <h2 className={styles.requestTitle} data-words="30">
            {request.title}
          </h2>
          <p className={styles.requestText}>
            {request.text}
          </p>

          <div className={styles.contact}>
            <div className={styles.avatar}>
              <Image src={vedalina.avatar} alt="" width={34} height={34} />
            </div>
            <div>
              <p className={styles.contactName}>
                {companyContact.title}
              </p>
              <p className={styles.contactRole}>
                {companyContact.scope} ·{" "}
                <a href={`mailto:${companyContact.email}`}>{companyContact.email}</a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
