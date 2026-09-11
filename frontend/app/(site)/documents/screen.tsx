import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { documentsHero } from "@/content/documents";
import { ui as strings } from "@/content/ui";
import { fetchDocuments } from "@/lib/api";
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

  return (
    <main className={styles.page}>
      <PageHero
        crumbs={[{ label: strings.crumbs.home, href: "/" }, { label: strings.crumbs.documents }]}
        title={documentsHero.title}
        lead={documentsHero.lead}
        currentPath="/documents/"
        pattern={163}
      />

      <DocumentsTable documents={documents} />
    </main>
  );
}
