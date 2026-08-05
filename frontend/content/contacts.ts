// Страница «Контакты» по docs/frontend/page_briefs.md → Contacts.
//
// Бриф требует три формы: продажи, сервис, партнёрство. Вместо трёх одинаковых
// форм — одна с выбором темы: состав полей у них совпадает, а темы взяты из
// handoff_forms в docs/frontend/content_model.md. Разведение по разным адресам
// произойдёт на стороне CRM, когда появится маршрутизация.

import { AWAITING, site } from "./site";

export const contactsHero = {
  eyebrow: "Контакты",
  headline: "Связаться с VEDAL",
  lead: "Позвоните, напишите на почту или оставьте обращение — запрос попадёт к профильному специалисту.",
};

// content_model.md → Urania Assistant Model → handoff_forms
export const topics = [
  "Запрос коммерческого предложения",
  "Запрос каталога",
  "Консультация по подбору",
  "Сервисное обращение",
  "Партнёрство и дилерство",
] as const;

export const contactBlocks = [
  {
    title: "Телефон",
    lines: [
      { text: site.phone, href: `tel:${site.phone.replace(/\s/g, "")}`, strong: true },
      { text: site.phoneExtra, href: `tel:${site.phoneExtra.replace(/[\s-]/g, "")}` },
      { text: site.phoneHours },
    ],
  },
  {
    title: "Почта",
    lines: [
      { text: site.email, href: `mailto:${site.email}`, strong: true },
      { text: `Отдельные адреса для сервиса и партнёров — ${AWAITING}` },
    ],
  },
  {
    title: "Адрес",
    lines: [{ text: site.address }, { text: "Приём по предварительной договорённости" }],
  },
];

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
