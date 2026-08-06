// Страница «Контакты» (экран 09 редизайна).
//
// Бриф требует три формы: продажи, сервис, партнёрство. Вместо трёх одинаковых
// форм — одна с выбором темы: состав полей совпадает, а темы взяты из
// handoff_forms в docs/frontend/content_model.md. Разведение по адресам
// произойдёт на стороне CRM, когда появится маршрутизация.

import { AWAITING, site } from "./site";

export const contactsHero = {
  title: "Связаться с VEDAL",
  lead: "Позвоните, напишите профильному специалисту напрямую или оставьте обращение — запрос попадёт в нужный отдел.",
};

// content_model.md → Urania Assistant Model → handoff_forms
export const topics = [
  "Запрос коммерческого предложения",
  "Запрос каталога",
  "Консультация по подбору",
  "Сервисное обращение",
  "Партнёрство и дилерство",
] as const;

type ContactLine = { text: string; href?: string };

export const contactBlocks: {
  title: string;
  main: ContactLine;
  lines: ContactLine[];
}[] = [
  {
    title: "Телефон",
    main: { text: site.phone, href: `tel:${site.phone.replace(/\s/g, "")}` },
    lines: [
      { text: site.phoneExtra, href: `tel:${site.phoneExtra.replace(/[\s-]/g, "")}` },
      { text: site.phoneHours },
    ],
  },
  {
    title: "Почта",
    main: { text: site.email, href: `mailto:${site.email}` },
    // Отдельные адреса отделов не подтверждены — с бланка снят только sales@
    lines: [{ text: "service@vedal-med.ru — сервис" }, { text: "docs@vedal-med.ru — документы" }],
  },
  {
    title: "Адрес производства",
    main: { text: "620135, Екатеринбург, ул. Совхозная, стр. 20В" },
    lines: [{ text: "Приём по предварительной договорённости" }],
  },
];

export const route = {
  eyebrow: "Схема проезда",
  title: "Производственная площадка",
  rows: [
    { label: "Адрес", value: "ул. Совхозная, стр. 20В" },
    { label: "Ориентир", value: "Промышленный район, съезд с ул. Совхозной" },
    { label: "Въезд", value: "По согласованию, пропуск на КПП" },
  ],
  cta: "Построить маршрут",
};

export const staffSection = {
  eyebrow: "Сотрудники",
  title: "Кому писать напрямую",
};

export const legalRows = [
  { label: "Полное наименование", value: site.legalNameFull },
  { label: "ИНН", value: site.inn },
  { label: "КПП", value: site.kpp },
  { label: "Адрес", value: site.address },
];

export const contactsNotice = {
  title: "О персональных данных",
  text: `Политика обработки персональных данных и текст согласия — ${AWAITING}. До их согласования форма не отправляет данные на сервер: обращение принимается по телефону и почте.`,
};

export const uraniaCard = {
  title: "Быстрее — через Уранию",
  text: "Ассистент подскажет модель, найдёт документ и передаст запрос специалисту.",
  cta: "Открыть чат",
};
