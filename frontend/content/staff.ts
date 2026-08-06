// ⚠ ДЕМО-ДАННЫЕ. Имена, должности, телефоны и адреса — заглушки из макета
// (design_handoff_vedal_redesign/README.md → Fidelity: «имена, должности,
// телефоны сотрудников — придуманные демо-данные»).
//
// Реальный список сотрудников числится в «Что нужно уточнить у заказчика».
// До согласования на странице «Контакты» стоит видимое примечание, что это
// заглушки, — убрать вместе с заменой данных.
//
// Почтовые адреса вида service@ / docs@ тоже не подтверждены: в
// docs/products/README.md с бланка снят только sales@vedal-med.ru.

export const DEMO_NOTE =
  "Имена, телефоны и адреса в этом блоке — заглушки. Заменим на реальные данные, когда согласуете список.";

export type Person = {
  name: string;
  role: string;
  scope?: string;
  phone: string;
  email: string;
};

export const staff: Person[] = [
  {
    name: "Андрей Кузнецов",
    role: "Коммерческий директор",
    scope: "Поставки, коммерческие предложения",
    phone: "+7 922 204 75 30",
    email: "sales@vedal-med.ru",
  },
  {
    name: "Ирина Соколова",
    role: "Руководитель отдела продаж",
    scope: "Тендеры, спецификации, сроки",
    phone: "+7 922 118 40 62",
    email: "tender@vedal-med.ru",
  },
  {
    name: "Дмитрий Лебедев",
    role: "Главный сервисный инженер",
    scope: "Сервис, монтаж, обучение персонала",
    phone: "+7 922 118 40 71",
    email: "service@vedal-med.ru",
  },
  {
    name: "Мария Орлова",
    role: "Специалист по документации",
    scope: "Регистрационные удостоверения, сертификаты, лицензии",
    phone: "+7 922 118 40 85",
    email: "docs@vedal-med.ru",
  },
  {
    name: "Сергей Волков",
    role: "Руководитель производства",
    scope: "Сроки изготовления и отгрузка",
    phone: "+7 922 118 40 93",
    email: "production@vedal-med.ru",
  },
  {
    name: "Ольга Ерёмина",
    role: "Маркетинг и пресс-служба",
    scope: "Материалы для СМИ, съёмка, выставки",
    phone: "+7 922 118 40 27",
    email: "press@vedal-med.ru",
  },
];

export const serviceEngineer = staff[2];
export const docsSpecialist = staff[3];
export const pressContact = staff[5];
