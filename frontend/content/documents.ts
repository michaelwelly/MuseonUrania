// Страница «Документы и лицензирование» (экран 07 редизайна).
//
// Правило из HANDOFF.md и docs/architecture/infrastructure_architecture.md:
// «Explicit publication approval before any document becomes public».
// У документа есть флаг published. Пока он false — файла нет, строка ведёт
// на форму запроса. Ни один документ пока не согласован к публикации,
// поэтому published: false стоит везде.

export const documentsHero = {
  title: "Документы и лицензирование",
  lead: "Регистрационные удостоверения, сертификаты, лицензии и техническая документация. У каждого документа указан статус доступа.",
};

export const groups = [
  "Лицензирование",
  "Система качества",
  "Техническая документация",
  "Коммерческие материалы",
] as const;

export type Group = (typeof groups)[number];
export type Access = "PDF" | "По запросу" | "Уточняется";

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

export const documents: Doc[] = [
  {
    title: "Лицензия на производство медицинских изделий",
    group: "Лицензирование",
    product: "ООО «ВЕДАЛ»",
    access: "По запросу",
    published: false,
  },
  {
    title: "Регистрационное удостоверение",
    group: "Лицензирование",
    product: "VEDAL R1, R2",
    access: "По запросу",
    published: false,
  },
  {
    title: "Регистрационное удостоверение",
    group: "Лицензирование",
    product: "VEDAL A-2000",
    access: "По запросу",
    published: false,
  },
  {
    title: "Регистрационное удостоверение",
    group: "Лицензирование",
    product: "VEDAL Т-100",
    access: "По запросу",
    published: false,
  },
  {
    title: "Сертификат ISO 13485",
    group: "Система качества",
    product: "Производство",
    access: "Уточняется",
    published: false,
  },
  {
    title: "Декларация о соответствии",
    group: "Система качества",
    product: "Все изделия",
    access: "Уточняется",
    published: false,
  },
  {
    title: "Описание изделия",
    group: "Техническая документация",
    product: "VEDAL R1, R2",
    access: "PDF",
    published: false,
  },
  {
    title: "Описание изделия",
    group: "Техническая документация",
    product: "VEDAL A-2000",
    access: "PDF",
    published: false,
  },
  {
    title: "Описание изделия",
    group: "Техническая документация",
    product: "VEDAL Т-100",
    access: "PDF",
    published: false,
  },
  {
    title: "Каталог продукции 2026",
    group: "Коммерческие материалы",
    product: "Все изделия",
    access: "PDF",
    published: false,
  },
];

export const order = {
  eyebrow: "Порядок публикации",
  title: "Каждый документ проходит согласование",
  text: "Технические, сервисные и производственные материалы на сайте не размещаются. Если нужный документ не опубликован — запросите его, специалист пришлёт актуальную редакцию.",
  legend: [
    { badge: "PDF" as Access, text: "файл доступен для скачивания сразу" },
    { badge: "По запросу" as Access, text: "высылаем после обращения" },
    { badge: "Уточняется" as Access, text: "статус документа согласуется" },
  ],
  // Ни один файл ещё не согласован — говорим об этом прямо, иначе бейдж PDF
  // обещает скачивание, которого нет.
  note: "Файлы пока не выложены: до согласования перечня любой документ высылается по запросу.",
};

export const request = {
  title: "Запрос документа",
  text: "Укажите документ и организацию — специалист по документации ответит в рабочие часы.",
  submit: "Запросить документ",
};
