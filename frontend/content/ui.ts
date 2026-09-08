import type { Lang } from "@/lib/i18n";
import { plural } from "@/lib/plural";
import { site } from "@/content/site";

// Словарь интерфейса: подписи, кнопки, заголовки разделов, состояния,
// ярлыки для скринридера.
//
// ───────────────────────────────────────────────────────────────────────────
// Где проходит граница с `content/translations.ts`
//
// Здесь — то, что пишем мы: навигация, кнопки, подписи полей, состояния
// («отправляем…», «публикаций пока нет»), заголовки разделов, ярлыки
// доступности. Их перевод не требует ничьего согласования: они ничего
// не утверждают об изделии.
//
// Там — то, что утверждает: описания изделий, характеристики, статусы
// регистрации, сроки, юридические формулировки. Их переводит заказчик,
// и до перевода страница показывает русский оригинал.
//
// Разделение прямо задано issue #54: «интерфейс переводим мы, контент —
// заказчик». Практическое следствие: правка кнопки не ждёт согласования,
// правка описания изделия — ждёт.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему один файл, а не три
//
// Тип `UiStrings` описан один раз, а `Record<Lang, UiStrings>` требует все
// три языка целиком: забытый ключ — ошибка компиляции, а не пустая кнопка
// на китайской версии. Разложенные по файлам словари этого не дают —
// расходятся молча и обнаруживаются глазами.

export type UiStrings = {
  /** Переключатель языка. */
  language: {
    label: string;
    /** Подпись выбранного языка для скринридера. */
    current: string;
  };

  /** Примечание о непереведённом. Для русского — пустая строка. */
  fallback: {
    page: string;
    legal: string;
    assistant: string;
  };

  meta: {
    siteTitle: string;
    siteDescription: string;
    about: string;
    products: string;
    productsLead: string;
    production: string;
    service: string;
    documents: string;
    news: string;
    contacts: string;
  };

  nav: {
    about: string;
    products: string;
    service: string;
    production: string;
    documents: string;
    news: string;
    contacts: string;
  };

  header: {
    cta: string;
    brandHome: string;
    mainNav: string;
    mobileNav: string;
    call: string;
    menu: string;
    hours: string;
  };

  footer: {
    company: string;
    equipment: string;
    neonatology: string;
    serviceSupport: string;
    documentsLicences: string;
    contacts: string;
    productionSuffix: string;
    privacy: string;
    staffLogin: string;
    subscribeTitle: string;
    subscribePlaceholder: string;
    subscribeSubmit: string;
  };

  crumbs: {
    home: string;
    about: string;
    products: string;
    production: string;
    service: string;
    documents: string;
    news: string;
    contacts: string;
    privacy: string;
  };

  actions: {
    requestQuote: string;
    catalogue: string;
    equipmentCatalogue: string;
    fullCatalogue: string;
    allNews: string;
    backToNews: string;
    allDocuments: string;
    seeProduction: string;
    requestDocument: string;
    howToGet: string;
    getDirections: string;
    contacts: string;
    askVedalina: string;
    requestSelection: string;
    serviceRequest: string;
    sendEnquiry: string;
  };

  form: {
    topic: string;
    name: string;
    company: string;
    phone: string;
    email: string;
    product: string;
    productOther: string;
    serialNumber: string;
    serialHint: string;
    message: string;
    submit: string;
    sending: string;
    again: string;
    errors: {
      name: string;
      phone: string;
      email: string;
      serialNumber: string;
      message: string;
      consent: string;
    };
    /** Не отправилось — куда написать. Собирается вокруг ссылок в разметке. */
    fallbackCall: string;
    fallbackWrite: string;
    fallbackEnd: string;
  };

  /** Короткая форма первого экрана: там свои подписи и свои плейсхолдеры. */
  homeForm: {
    name: string;
    company: string;
    phone: string;
    email: string;
    messagePlaceholder: string;
    messageLabel: string;
    submit: string;
    errors: { name: string; message: string };
  };

  home: {
    catalogueEyebrow: string;
    catalogueTitle: string;
    docHeadName: string;
    docHeadType: string;
    docHeadAccess: string;
    newsTitle: string;
    noPublications: string;
  };

  products: {
    heroTitle: string;
    listHeading: string;
    photoPending: string;
    ctaTitle: string;
    ctaText: string;
  };

  product: {
    purpose: string;
    features: string;
    other: string;
    tabs: {
      specs: string;
      kit: string;
      documents: string;
      service: string;
    };
    documentsTitle: string;
    /** Подвал вкладки «Документы»: где искать то, чего нет у изделия. */
    allDocuments: string;
    notInListing: string;
    requestIt: string;
    /** Форма запроса КП на самой карточке: заголовок и что она делает. */
    quoteTitle: string;
    quoteText: string;
  };

  documents: {
    all: string;
    headName: string;
    headGroup: string;
    headProduct: string;
    headAccess: string;
    empty: string;
    /** Что произойдёт по нажатию на строку перечня. */
    open: string;
    request: string;
    /** Счётчик найденного: подставляется число. */
    count: (n: number) => string;
  };

  news: {
    all: string;
    emptyTitle: string;
    /** Заголовок формы подписки на странице новостей: там своя формулировка, не подвальная. */
    subscribeTitle: string;
    subscribeInvalid: string;
    /** Подписки ещё нет — говорим об этом прямо и даём почту. */
    subscribePending: (email: string) => string;
  };

  service: {
    enquiryLabel: string;
  };

  contacts: {
    formTitle: string;
    messageLabel: string;
    legalTitle: string;
    /** Подписи карточек контактов: ключ — русский оригинал из content/contacts.ts. */
    blockTitles: Record<string, string>;
  };
};

const ru: UiStrings = {
  language: { label: "Язык сайта", current: "Текущий язык" },
  fallback: {
    page: "",
    legal: "",
    assistant: "",
  },
  meta: {
    siteTitle: "VEDAL — российское медицинское оборудование",
    siteDescription:
      "Собственное производство и современные решения для неонатологии, реанимации, анестезиологии и интенсивной терапии.",
    about: "О компании — VEDAL",
    products: "Каталог оборудования — VEDAL",
    productsLead:
      "Изделия для неонатологии, реанимации, анестезиологии, мониторинга и интенсивной терапии. У каждой позиции указан статус документации.",
    production: "Производство — VEDAL",
    service: "Сервис — VEDAL",
    documents: "Документы и лицензирование — VEDAL",
    news: "Новости и пресс-центр — VEDAL",
    contacts: "Контакты — VEDAL",
  },
  nav: {
    about: "О компании",
    products: "Продукция",
    service: "Сервис",
    production: "Производство",
    documents: "Документы",
    news: "Новости",
    contacts: "Контакты",
  },
  header: {
    cta: "Связаться с нами",
    brandHome: "VEDAL, на главную",
    mainNav: "Основная навигация",
    mobileNav: "Мобильная навигация",
    call: "Позвонить",
    menu: "Меню",
    // Не строкой: часы уже правились однажды (issue #76, было 9:00–18:00),
    // и вторая копия разошлась бы с первой молча. Русский вариант берётся
    // из content/site.ts, перевод стоит рядом в en.
    hours: site.phoneHours,
  },
  footer: {
    company: "Компания",
    equipment: "Оборудование",
    neonatology: "Неонатология",
    serviceSupport: "Сервис и поддержка",
    documentsLicences: "Документы и лицензии",
    contacts: "Контакты",
    productionSuffix: "— производство",
    privacy: "Политика обработки персональных данных",
    staffLogin: "Вход для сотрудников",
    subscribeTitle: "Новости и релизы",
    subscribePlaceholder: "Рабочая почта",
    subscribeSubmit: "Подписаться",
  },
  crumbs: {
    home: "Главная",
    about: "О компании",
    products: "Продукция",
    production: "Производство",
    service: "Сервис",
    documents: "Документы",
    news: "Новости",
    contacts: "Контакты",
    privacy: "Персональные данные",
  },
  actions: {
    requestQuote: "Запросить КП",
    catalogue: "Каталог",
    equipmentCatalogue: "Каталог оборудования",
    fullCatalogue: "Весь каталог",
    allNews: "Все новости",
    backToNews: "← Все новости",
    allDocuments: "Все документы",
    seeProduction: "Смотреть производство",
    requestDocument: "Запросить документ",
    howToGet: "Схема проезда",
    getDirections: "Построить маршрут",
    contacts: "Контакты",
    askVedalina: "Спросить Ведалину",
    requestSelection: "Запросить подбор",
    serviceRequest: "Сервисная заявка",
    sendEnquiry: "Отправить обращение",
  },
  form: {
    topic: "Тема обращения",
    name: "Контактное лицо",
    company: "Организация",
    phone: "Телефон",
    email: "Электронная почта",
    product: "Изделие",
    productOther: "Другое или не знаю",
    serialNumber: "Серийный номер",
    serialHint: "Если знаете — ускорит разбор обращения",
    message: "Суть обращения",
    submit: "Отправить запрос",
    sending: "Отправляем…",
    again: "Отправить ещё одно обращение",
    errors: {
      name: "Укажите, к кому обращаться",
      phone: "Укажите телефон с кодом",
      email: "Проверьте адрес почты",
      serialNumber: "Серийный номер не длиннее 100 символов",
      message: "Опишите обращение хотя бы одной фразой",
      consent: "Без согласия отправить запрос нельзя",
    },
    fallbackCall: "Позвоните",
    fallbackWrite: "или напишите на",
    fallbackEnd: ".",
  },
  homeForm: {
    name: "Имя",
    company: "Организация",
    phone: "Телефон",
    email: "Рабочая почта",
    messagePlaceholder: "Задача отделения, модель или вопрос",
    messageLabel: "Сообщение",
    submit: "Отправить запрос",
    errors: {
      name: "Как к вам обращаться",
      message: "Опишите задачу хотя бы одной фразой",
    },
  },
  home: {
    catalogueEyebrow: "Каталог",
    catalogueTitle: "Оборудование VEDAL",
    docHeadName: "Документ",
    docHeadType: "Тип",
    docHeadAccess: "Доступ",
    newsTitle: "Новости",
    noPublications: "Публикаций пока нет",
  },
  products: {
    heroTitle: "Каталог оборудования",
    listHeading: "Список изделий",
    photoPending: "Фото ожидает съёмки",
    ctaTitle: "Не нашли нужную конфигурацию?",
    ctaText:
      "Опишите задачу отделения — Ведалина подскажет модели сразу, а специалист подготовит предложение с характеристиками и документами.",
  },
  product: {
    purpose: "Назначение",
    features: "Ключевые особенности",
    other: "Другие продукты",
    tabs: {
      specs: "Характеристики",
      kit: "Комплектация",
      documents: "Документы",
      service: "Сервис и обучение",
    },
    documentsTitle: "Документы к изделию",
    allDocuments: "Все документы и лицензирование",
    notInListing: "не найденное в перечне —",
    requestIt: "запрашивается у специалиста",
    quoteTitle: "Запросить КП на это изделие",
    quoteText:
      "Изделие уже подставлено — выбирать его заново не нужно. Конфигурацию и стоимость считает специалист: цен на сайте нет.",
  },
  documents: {
    all: "Все документы",
    headName: "Документ",
    headGroup: "Раздел",
    headProduct: "Изделие",
    headAccess: "Доступ",
    empty: "В этом разделе пока нет документов.",
    open: "Открыть",
    request: "Запросить",
    // Склонение считает `lib/plural.ts`, а не выражение по месту: правило
    // русского счётного согласования уже написано там один раз, вместе
    // с исключением для вторых десятков («11 документов», не «11 документ»).
    count: (n) => `${n} ${plural(n, "документ", "документа", "документов")}`,
  },
  news: {
    all: "Все",
    emptyTitle: "Публикаций пока нет",
    subscribeTitle: "Подписка на релизы",
    subscribeInvalid: "Проверьте адрес почты.",
    subscribePending: (email) =>
      `Рассылка ещё не подключена. Напишите на ${email} — добавим вас в список.`,
  },
  service: {
    enquiryLabel: "Сервисное обращение",
  },
  contacts: {
    formTitle: "Оставить обращение",
    messageLabel: "Сообщение",
    legalTitle: "Реквизиты",
    blockTitles: {},
  },
};

const en: UiStrings = {
  language: { label: "Site language", current: "Current language" },
  fallback: {
    page:
      "Product descriptions, specifications and document statuses on this page are shown in Russian: VEDAL has not approved a translation for them yet.",
    legal:
      "Legal texts are published in Russian only. A translation carries no legal force until VEDAL approves it.",
    assistant: "Vedalina answers in the language of your question. Her interface is still in Russian.",
  },
  meta: {
    siteTitle: "VEDAL — medical equipment made in Russia",
    siteDescription:
      "In-house manufacturing and modern solutions for neonatology, resuscitation, anaesthesiology and intensive care.",
    about: "About the company — VEDAL",
    products: "Equipment catalogue — VEDAL",
    productsLead:
      "Devices for neonatology, resuscitation, anaesthesiology, monitoring and intensive care. Every item carries its documentation status.",
    production: "Manufacturing — VEDAL",
    service: "Service — VEDAL",
    documents: "Documents and licensing — VEDAL",
    news: "News and press centre — VEDAL",
    contacts: "Contacts — VEDAL",
  },
  nav: {
    about: "About",
    products: "Products",
    service: "Service",
    production: "Manufacturing",
    documents: "Documents",
    news: "News",
    contacts: "Contacts",
  },
  header: {
    cta: "Contact us",
    brandHome: "VEDAL, to the home page",
    mainNav: "Main navigation",
    mobileNav: "Mobile navigation",
    call: "Call",
    menu: "Menu",
    hours: "Mon–Fri 9:00–17:30",
  },
  footer: {
    company: "Company",
    equipment: "Equipment",
    neonatology: "Neonatology",
    serviceSupport: "Service and support",
    documentsLicences: "Documents and licences",
    contacts: "Contacts",
    productionSuffix: "— manufacturing site",
    privacy: "Personal data policy",
    staffLogin: "Staff login",
    subscribeTitle: "News and releases",
    subscribePlaceholder: "Work email",
    subscribeSubmit: "Subscribe",
  },
  crumbs: {
    home: "Home",
    about: "About",
    products: "Products",
    production: "Manufacturing",
    service: "Service",
    documents: "Documents",
    news: "News",
    contacts: "Contacts",
    privacy: "Personal data",
  },
  actions: {
    requestQuote: "Request a quote",
    catalogue: "Catalogue",
    equipmentCatalogue: "Equipment catalogue",
    fullCatalogue: "Full catalogue",
    allNews: "All news",
    backToNews: "← All news",
    allDocuments: "All documents",
    seeProduction: "See the manufacturing site",
    requestDocument: "Request a document",
    howToGet: "How to get here",
    getDirections: "Get directions",
    contacts: "Contacts",
    askVedalina: "Ask Vedalina",
    requestSelection: "Ask for a selection",
    serviceRequest: "Service request",
    sendEnquiry: "Send the enquiry",
  },
  form: {
    topic: "Subject",
    name: "Contact person",
    company: "Organisation",
    phone: "Phone",
    email: "Email",
    product: "Product",
    productOther: "Other or not sure",
    serialNumber: "Serial number",
    serialHint: "If you know it, this speeds up the response",
    message: "Your enquiry",
    submit: "Send the request",
    sending: "Sending…",
    again: "Send another enquiry",
    errors: {
      name: "Tell us who to address",
      phone: "Enter a phone number with the country or area code",
      email: "Check the email address",
      serialNumber: "The serial number must be 100 characters or fewer",
      message: "Describe your enquiry in at least one sentence",
      consent: "We cannot send the request without your consent",
    },
    fallbackCall: "Call",
    fallbackWrite: "or write to",
    fallbackEnd: ".",
  },
  homeForm: {
    name: "Name",
    company: "Organisation",
    phone: "Phone",
    email: "Work email",
    messagePlaceholder: "Your department's task, a model or a question",
    messageLabel: "Message",
    submit: "Send the request",
    errors: {
      name: "How should we address you?",
      message: "Describe the task in at least one sentence",
    },
  },
  home: {
    catalogueEyebrow: "Catalogue",
    catalogueTitle: "VEDAL equipment",
    docHeadName: "Document",
    docHeadType: "Type",
    docHeadAccess: "Access",
    newsTitle: "News",
    noPublications: "No publications yet",
  },
  products: {
    heroTitle: "Equipment catalogue",
    listHeading: "Product list",
    photoPending: "Photo pending",
    ctaTitle: "Didn't find the configuration you need?",
    ctaText:
      "Describe what your department needs — Vedalina will suggest models straight away, and a specialist will prepare an offer with specifications and documents.",
  },
  product: {
    purpose: "Intended use",
    features: "Key features",
    other: "Other products",
    tabs: {
      specs: "Specifications",
      kit: "Configuration",
      documents: "Documents",
      service: "Service and training",
    },
    documentsTitle: "Documents for this product",
    allDocuments: "All documents and licensing",
    notInListing: "anything not in the listing can be",
    requestIt: "requested from a specialist",
    quoteTitle: "Request a quote for this product",
    quoteText:
      "The product is already filled in — no need to pick it again. Configuration and pricing are worked out by a specialist: no prices are published on the site.",
  },
  documents: {
    all: "All documents",
    headName: "Document",
    headGroup: "Section",
    headProduct: "Product",
    headAccess: "Access",
    empty: "There are no documents in this section yet.",
    open: "Open",
    request: "Request",
    count: (n) => `${n} ${n === 1 ? "document" : "documents"}`,
  },
  news: {
    all: "All",
    emptyTitle: "No publications yet",
    subscribeTitle: "Subscribe to releases",
    subscribeInvalid: "Check the email address.",
    subscribePending: (email) =>
      `The mailing list is not running yet. Write to ${email} and we will add you.`,
  },
  service: {
    enquiryLabel: "Service enquiry",
  },
  contacts: {
    formTitle: "Send an enquiry",
    messageLabel: "Message",
    legalTitle: "Company details",
    blockTitles: {
      Телефон: "Phone",
      Почта: "Email",
      Адрес: "Address",
      "Адрес производства": "Manufacturing address",
    },
  },
};


export const UI: Record<Lang, UiStrings> = { ru, en };

export function ui(lang: Lang): UiStrings {
  return UI[lang];
}
