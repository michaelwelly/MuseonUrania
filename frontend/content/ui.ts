import { plural } from "@/lib/plural";
import { site } from "@/content/site";

// Словарь интерфейса: подписи, кнопки, заголовки разделов, состояния,
// ярлыки для скринридера.
//
// ───────────────────────────────────────────────────────────────────────────
// Что здесь лежит, а что в `content/*.ts`
//
// Здесь — то, что пишем мы: навигация, кнопки, подписи полей, состояния
// («отправляем…», «публикаций пока нет»), заголовки разделов, ярлыки
// доступности.
//
// Там — то, что утверждает об изделии: описания, характеристики, статусы
// регистрации, сроки, юридические формулировки. Правка кнопки не ждёт
// ничьего согласования, правка описания изделия — ждёт заказчика.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему словарь один
//
// Сайт одноязычный: русский и только он. Английская и китайская версии
// сняты 9 сентября по решению владельца портала — на них уходила
// навигация с непереведённым текстом под ней, а англоязычный браузер
// автоопределение уводило на `/en/…`, где страниц нет, то есть в 404.
// Адреса с префиксом остались редиректом на корень (`next.config.ts`).
//
// Тип `UiStrings` описан отдельно от значения намеренно: он держит форму
// словаря и не даёт забыть ключ при правке.

export type UiStrings = {
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
    productChoose: string;
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
      product: string;
      serialNumber: string;
      serialRequired: string;
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
  };

  /**
   * Страница «не найдено». Интерфейс, а не содержание: она ничего не
   * утверждает ни об изделиях, ни о документах — только объясняет, что
   * адрес не открылся, и показывает, куда идти дальше.
   */
  notFound: {
    title: string;
    /** Почему страницы нет. Причина названа честно: адреса просто нет. */
    text: string;
    /** Подпись над списком разделов. */
    linksTitle: string;
    /** Что делать, если сюда привела ссылка с сайта. */
    reportText: string;
  };
};

export const ui: UiStrings = {
  meta: {
    siteTitle: "VEDAL — медицинское оборудование",
    siteDescription:
      "Российский производитель оборудования для неонатологии, реанимации и интенсивной терапии.",
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
    // и вторая копия разошлась бы с первой молча. Значение берётся
    // из content/site.ts — там же, откуда его берёт страница контактов.
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
    productChoose: "Выберите изделие",
    serialNumber: "Серийный номер",
    serialHint: "Обязателен: по нему инженер определит конкретный аппарат",
    message: "Суть обращения",
    submit: "Отправить запрос",
    sending: "Отправляем…",
    again: "Отправить ещё одно обращение",
    errors: {
      name: "Укажите, к кому обращаться",
      phone: "Укажите телефон с кодом",
      email: "Проверьте адрес почты",
      product: "Выберите изделие из списка",
      serialNumber: "Серийный номер не длиннее 100 символов",
      serialRequired: "Укажите серийный номер — по нему инженер определит изделие",
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
  },
  notFound: {
    title: "Страница не найдена",
    // Причин у 404 ровно две — адрес набран с ошибкой или страницы больше
    // нет, — и обе названы. Догадки вроде «изделие снято с производства»
    // сюда писать нельзя: сайт этого не знает.
    text: "По этому адресу на сайте ничего нет. Возможно, в ссылке опечатка или страницу перенесли.",
    linksTitle: "Куда можно перейти",
    reportText:
      "Если сюда привела ссылка с сайта — сообщите, поправим: позвоните или напишите на общий адрес.",
  },
};
