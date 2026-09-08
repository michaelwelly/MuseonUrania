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
    // из content/site.ts, переводы стоят рядом в en/zh.
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

const zh: UiStrings = {
  language: { label: "网站语言", current: "当前语言" },
  fallback: {
    page: "本页的产品说明、技术参数和文件状态以俄语显示：VEDAL 尚未批准相应译文。",
    legal: "法律文本仅以俄语发布。未经 VEDAL 批准的译文不具法律效力。",
    assistant: "Vedalina 会用您提问的语言回答，但其界面目前仍为俄语。",
  },
  meta: {
    siteTitle: "VEDAL — 俄罗斯制造的医疗设备",
    siteDescription: "自有生产基地，为新生儿科、复苏科、麻醉科和重症监护提供现代化解决方案。",
    about: "关于公司 — VEDAL",
    products: "设备目录 — VEDAL",
    productsLead: "用于新生儿科、复苏科、麻醉科、监护和重症监护的设备。每件产品均标注文件状态。",
    production: "生产 — VEDAL",
    service: "服务 — VEDAL",
    documents: "文件与许可 — VEDAL",
    news: "新闻中心 — VEDAL",
    contacts: "联系方式 — VEDAL",
  },
  nav: {
    about: "关于公司",
    products: "产品",
    service: "服务",
    production: "生产",
    documents: "文件",
    news: "新闻",
    contacts: "联系方式",
  },
  header: {
    cta: "联系我们",
    brandHome: "VEDAL，返回首页",
    mainNav: "主导航",
    mobileNav: "移动端导航",
    call: "拨打电话",
    menu: "菜单",
    hours: "周一至周五 9:00–17:30",
  },
  footer: {
    company: "公司",
    equipment: "设备",
    neonatology: "新生儿科",
    serviceSupport: "服务与支持",
    documentsLicences: "文件与许可证",
    contacts: "联系方式",
    productionSuffix: "——生产基地",
    privacy: "个人数据处理政策",
    staffLogin: "员工登录",
    subscribeTitle: "新闻与产品发布",
    subscribePlaceholder: "工作邮箱",
    subscribeSubmit: "订阅",
  },
  crumbs: {
    home: "首页",
    about: "关于公司",
    products: "产品",
    production: "生产",
    service: "服务",
    documents: "文件",
    news: "新闻",
    contacts: "联系方式",
    privacy: "个人数据",
  },
  actions: {
    requestQuote: "索取报价",
    catalogue: "产品目录",
    equipmentCatalogue: "设备目录",
    fullCatalogue: "全部目录",
    allNews: "全部新闻",
    backToNews: "← 全部新闻",
    allDocuments: "全部文件",
    seeProduction: "了解生产",
    requestDocument: "索取文件",
    howToGet: "交通路线",
    getDirections: "规划路线",
    contacts: "联系方式",
    askVedalina: "咨询 Vedalina",
    requestSelection: "请求选型",
    serviceRequest: "服务申请",
    sendEnquiry: "发送咨询",
  },
  form: {
    topic: "咨询主题",
    name: "联系人",
    company: "单位名称",
    phone: "电话",
    email: "电子邮箱",
    product: "产品",
    productOther: "其他或不确定",
    serialNumber: "序列号",
    serialHint: "如果知道，可加快处理速度",
    message: "咨询内容",
    submit: "发送请求",
    sending: "正在发送…",
    again: "再发送一条咨询",
    errors: {
      name: "请填写联系人",
      phone: "请填写含国家或地区代码的电话号码",
      email: "请检查电子邮箱地址",
      serialNumber: "序列号不得超过 100 个字符",
      message: "请至少用一句话描述您的需求",
      consent: "未获得同意，无法发送请求",
    },
    fallbackCall: "请致电",
    fallbackWrite: "或写信至",
    fallbackEnd: "。",
  },
  homeForm: {
    name: "姓名",
    company: "单位名称",
    phone: "电话",
    email: "工作邮箱",
    messagePlaceholder: "科室需求、机型或问题",
    messageLabel: "留言",
    submit: "发送请求",
    errors: {
      name: "请填写称呼",
      message: "请至少用一句话描述任务",
    },
  },
  home: {
    catalogueEyebrow: "产品目录",
    catalogueTitle: "VEDAL 设备",
    docHeadName: "文件",
    docHeadType: "类别",
    docHeadAccess: "获取方式",
    newsTitle: "新闻",
    noPublications: "暂无发布内容",
  },
  products: {
    heroTitle: "设备目录",
    listHeading: "产品列表",
    photoPending: "照片待拍摄",
    ctaTitle: "没有找到所需配置？",
    ctaText:
      "请描述科室的需求——Vedalina 会立即推荐机型，专家将准备包含技术参数和文件的方案。",
  },
  product: {
    purpose: "预期用途",
    features: "主要特点",
    other: "其他产品",
    tabs: {
      specs: "技术参数",
      kit: "配置",
      documents: "文件",
      service: "服务与培训",
    },
    documentsTitle: "该产品的文件",
    allDocuments: "全部文件与许可",
    notInListing: "清单中没有的文件，可向专家",
    requestIt: "索取",
  },
  documents: {
    all: "全部文件",
    headName: "文件",
    headGroup: "分类",
    headProduct: "产品",
    headAccess: "获取方式",
    empty: "该分类下暂无文件。",
    open: "打开",
    request: "索取",
    count: (n) => `${n} 份文件`,
  },
  news: {
    all: "全部",
    emptyTitle: "暂无发布内容",
    subscribeTitle: "订阅产品发布",
    subscribeInvalid: "请检查电子邮箱地址。",
    subscribePending: (email) => `订阅功能尚未开通。请写信至 ${email}，我们会把您加入名单。`,
  },
  service: {
    enquiryLabel: "服务咨询",
  },
  contacts: {
    formTitle: "发送咨询",
    messageLabel: "留言",
    legalTitle: "公司信息",
    blockTitles: {
      Телефон: "电话",
      Почта: "电子邮箱",
      Адрес: "地址",
      "Адрес производства": "生产地址",
    },
  },
};

export const UI: Record<Lang, UiStrings> = { ru, en, zh };

export function ui(lang: Lang): UiStrings {
  return UI[lang];
}
