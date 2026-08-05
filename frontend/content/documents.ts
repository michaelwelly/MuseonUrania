// Страница «Документы» по docs/frontend/page_briefs.md → Documents.
//
// Правило из HANDOFF.md и docs/architecture/infrastructure_architecture.md:
// «Explicit publication approval before any document becomes public».
// Поэтому у документа есть флаг published. Пока он false — файл не отдаётся,
// вместо ссылки на скачивание показывается запрос через форму.
// Датащиты физически лежат в репозитории (docs/products/), выложить их —
// это переключить один флаг, но сделать это должен заказчик, не я.

import { AWAITING } from "./site";

export const documentsHero = {
  eyebrow: "Документы",
  headline: "Документация и разрешительные документы",
  lead: "Документы публикуются после согласования. Ниже — что уже подготовлено и что ожидает подтверждения.",
};

export type Doc = {
  title: string;
  type: string;
  products: string;
  published: boolean;
  /** Заполняется вместе с published: true */
  file?: string;
};

export const documents: Doc[] = [
  {
    title: "Системы реанимационные VEDAL R1, R2",
    type: "Описание изделия",
    products: "VEDAL R1, R2",
    published: false,
  },
  {
    title: "Инкубатор-трансформер VEDAL A-2000",
    type: "Описание изделия",
    products: "VEDAL A-2000",
    published: false,
  },
  {
    title: "Система терморегулирующая VEDAL Т-100",
    type: "Описание изделия",
    products: "VEDAL Т-100",
    published: false,
  },
];

// Разделы из page_briefs.md → Documents → Required sections
export const sections = [
  {
    title: "Каталог продукции",
    text: `Сводный каталог по всем изделиям — ${AWAITING}.`,
  },
  {
    title: "Сертификаты",
    text: `Сертификаты соответствия и декларации, включая ISO 13485, — ${AWAITING}.`,
  },
  {
    title: "Регистрационные удостоверения",
    text: `Статус регистрации по каждому изделию — ${AWAITING}.`,
  },
  {
    title: "Пресс-материалы",
    text: `Материалы для СМИ и медиакит — ${AWAITING}.`,
  },
];

export const documentsNotice = {
  title: "Порядок публикации",
  text: "Каждый документ проходит согласование перед публикацией. Технические, сервисные и производственные материалы во внутреннем контуре и на сайте не размещаются. Если нужный документ не опубликован, запросите его — специалист пришлёт актуальную редакцию.",
};
