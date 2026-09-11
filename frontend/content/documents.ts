// Страница «Документы и лицензирование» (экран 07 редизайна).
//
// Актуальный открытый пакет документов фиксирует миграция V36. Этот файл —
// запасной перечень для режима вёрстки без API.

export const documentsHero = {
  title: "Документы и лицензирование",
  lead: "Открытые материалы VEDAL: карточки изделий, сертификат, членство и коммерческие материалы. Файлы открываются через портал и используются в поиске Ведалины.",
};

// Группы перечня. Список ведущий для фильтров на странице: группа, которой
// здесь нет, в чипсы не попадёт — строка будет видна в общем списке, но
// отфильтровать её станет нечем. Заводя группу в базе (проверка doc_group
// в V10 и V27), заведите её и здесь.
export const groups = [
  "Техническая документация",
  "Система качества",
  "Коммерческие материалы",
  "О компании",
] as const;

export type Group = (typeof groups)[number];

// Подписи уровней доступа. `pdf` в базе называется здесь «Файл»: портал
// принимает не только PDF, а перечень не отдаёт тип файла — формат сайт
// обещать не вправе (issue #73). Переименована подпись, а не значение
// в базе: там по-прежнему `pdf`, и миграции этого не касаются.
export type Access = "Файл" | "По запросу" | "Уточняется";

export type Doc = {
  title: string;
  group: Group;
  product: string;
  /** Планируемый уровень доступа. */
  access: Access;
  /** Файл реально выложен. Пока нигде не true. */
  published: boolean;
  file?: string;
};

const file = (slug: string) => `https://vedal-med.ru/api/public/v1/documents/${slug}/file`;

export const documents: Doc[] = [
  {
    title: "Инкубатор-трансформер VEDAL A-2000",
    group: "Техническая документация",
    product: "VEDAL A-2000",
    access: "Файл",
    published: true,
    file: file("vedal-a-2000-product-sheet"),
  },
  {
    title: "Система реанимационная VEDAL R1",
    group: "Техническая документация",
    product: "VEDAL R1",
    access: "Файл",
    published: true,
    file: file("vedal-r1-product-sheet"),
  },
  {
    title: "Система реанимационная VEDAL R2",
    group: "Техническая документация",
    product: "VEDAL R2",
    access: "Файл",
    published: true,
    file: file("vedal-r2-product-sheet"),
  },
  {
    title: "Система терморегулирующая VEDAL T-100",
    group: "Техническая документация",
    product: "VEDAL T-100",
    access: "Файл",
    published: true,
    file: file("vedal-t-100-product-sheet"),
  },
  {
    title: "Сертификат соответствия ООО «ВЕДАЛ»",
    group: "Система качества",
    product: "ООО «ВЕДАЛ»",
    access: "Файл",
    published: true,
    file: file("vedal-certificate-conformity"),
  },
  {
    title: "Каталог продукции VEDAL",
    group: "Коммерческие материалы",
    product: "Все изделия",
    access: "Файл",
    published: true,
    file: file("vedal-product-catalog"),
  },
  {
    title: "Буклет VEDAL для ИННОПРОМ",
    group: "Коммерческие материалы",
    product: "Все изделия",
    access: "Файл",
    published: true,
    file: file("vedal-buklet-innoprom-2026"),
  },
  {
    title: "Членский билет Уральской торгово-промышленной палаты",
    group: "О компании",
    product: "ООО «ВЕДАЛ»",
    access: "Файл",
    published: true,
    file: file("vedal-utpp-membership-ticket"),
  },
];
