// Страница «Контакты» (экран 09 редизайна).
//
// Бриф требует три формы: продажи, сервис, партнёрство. Вместо трёх одинаковых
// форм — одна с выбором темы: состав полей совпадает, а темы взяты из
// handoff_forms в docs/frontend/content_model.md. Разведение по адресам
// произойдёт на стороне CRM, когда появится маршрутизация.

import { AWAITING, site } from "./site";

export const contactsHero = {
  title: "Связаться с VEDAL",
  lead: "Позвоните, напишите на общий адрес или оставьте обращение — запрос попадёт в нужный отдел.",
};

// content_model.md → Urania Assistant Model → handoff_forms
// Код темы — это тип заявки в Forms API (`quote | catalog | consultation |
// service | partner`). Подпись меняется без миграции, код — нет.
export const topics = [
  { code: "quote", label: "Запрос коммерческого предложения" },
  { code: "catalog", label: "Запрос каталога" },
  { code: "consultation", label: "Консультация по подбору" },
  { code: "service", label: "Сервисное обращение" },
  { code: "partner", label: "Партнёрство и дилерство" },
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
    // Публично остаётся один номер — тот, что стоит на бланке датащитов.
    // Второй (+7 922…) снят 18 августа по §9.2 плана: он не подтверждён
    // заказчиком, а на сайте номер читается как обещание, что по нему ответят.
    lines: [{ text: site.phoneHours }],
  },
  {
    title: "Почта",
    main: { text: site.email, href: `mailto:${site.email}` },
    // service@ и docs@ отсюда убраны: с бланка снят только sales@, остальные
    // адреса взяты из макета. Письмо на несуществующий ящик молча пропадает.
    lines: [{ text: "Ответ в рабочие часы" }],
  },
  {
    title: "Адрес производства",
    main: { text: "620135, Екатеринбург, ул. Совхозная, стр. 20В" },
    // Приём посетителей не обещаем — §6.3 плана. Порядок въезда для
    // поставок остаётся ниже, в схеме проезда.
    lines: [],
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
  title: "Куда попадёт обращение",
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
