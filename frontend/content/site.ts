// Структурированный контент по docs/frontend/content_model.md.
// Правило из HANDOFF.md: недостающие факты не выдумывать, ставить AWAITING.

export const AWAITING = "ожидает уточнения";

export const site = {
  brand: "VEDAL",
  // Подтверждён бланком датащитов, см. docs/products/README.md.
  phone: "8 800 600 3449",
  // Публично не показывается: §9.2 плана от 18 августа требует оставить на
  // сайте только подтверждённый номер. Значение остаётся здесь, чтобы вернуть
  // его одной правкой, когда заказчик подтвердит, что по нему отвечают.
  phoneExtra: "+7 922 204 75 30",
  phoneHours: "Пн–Пт 9:00–18:00",
  // Реквизиты с бланка датащитов, см. docs/products/README.md
  email: "sales@vedal-med.ru",
  legalName: "ООО «ВЕДАЛ»",
  legalNameFull: "Общество с ограниченной ответственностью «ВЕДАЛ»",
  address: "620135, Свердловская область, г. Екатеринбург, ул. Совхозная, стр. 20В",
  inn: "5406826069",
  kpp: "540601001",
  logo: { src: "/brand/vedal-logo.png", width: 461, height: 386 },
};

// CTA шапки по макету заказчика. В hero остаётся «Запросить КП».
export const headerCta = { label: "Связаться с нами", href: "/contacts/" };

// Семь пунктов редизайна. «Разработка и технологии» удалён вместе с разделом —
// прямое требование заказчика из хендоффа.
export const nav = [
  { label: "О компании", href: "/about/" },
  { label: "Продукция", href: "/products/" },
  { label: "Сервис", href: "/service/" },
  { label: "Производство", href: "/production/" },
  { label: "Документы", href: "/documents/" },
  { label: "Новости", href: "/news/" },
  { label: "Контакты", href: "/contacts/" },
];

// Верхняя утилитарная полоса шапки
export const topbar = {
  note: "Екатеринбург, ул. Совхозная, стр. 20В — собственное производство",
  noteShort: "Собственное производство · Екатеринбург",
  links: [
    { label: "Лицензии и разрешительные документы", href: "/documents/" },
    { label: "Сервисный запрос", href: "/service/" },
  ],
};

// Футер
export const footer = {
  about:
    "Производим оборудование для неонатологии, реанимации, анестезиологии и интенсивной терапии. Разработка, сборка и сервис — внутри одной компании.",
  columns: [
    {
      title: "Компания",
      links: [
        { label: "О компании", href: "/about/" },
        { label: "Производство", href: "/production/" },
        { label: "Документы и лицензии", href: "/documents/" },
        { label: "Новости", href: "/news/" },
        { label: "Контакты", href: "/contacts/" },
      ],
    },
    {
      title: "Оборудование",
      links: [
        { label: "Неонатология", href: "/products/" },
        { label: "Реанимация", href: "/products/" },
        { label: "Анестезиология", href: "/products/" },
        { label: "Мониторинг", href: "/products/" },
        { label: "Сервис и поддержка", href: "/service/" },
      ],
    },
  ],
  // Ссылки на аккаунты заказчик не передавал — до этого пилюли никуда не ведут.
  messengers: [
    { label: "Telegram", href: null },
    { label: "WhatsApp", href: null },
    { label: "VK", href: null },
  ],
  subscribe: {
    title: "Новости и релизы",
    placeholder: "Рабочая почта",
    note: "Отправляя почту, вы соглашаетесь с политикой обработки персональных данных.",
  },
  disclaimer:
    "Информация на сайте не является публичной офертой. Регистрационные удостоверения публикуются после согласования.",
};

// docs/frontend/page_briefs.md → Home → Hero draft
export const hero = {
  headline: "Российское медицинское оборудование",
  lead: "Собственное производство и современные решения для неонатологии, реанимации, анестезиологии и интенсивной терапии.",
  primaryCta: { label: "Запросить КП", href: "/contacts/" },
  secondaryCta: { label: "Каталог", href: "/products/" },
  proofs: [
    "Российское производство",
    "Документы после согласования",
    "Сервисные запросы",
    "Подбор категории оборудования",
  ],
  // Фото производственной площадки из архива заказчика (кадр 164).
  // Сжато до 1600px, оригинал 2000×1331 остаётся у заказчика.
  image: {
    src: "/photos/vedal-production-line.jpg",
    alt: "Производственная площадка VEDAL: инкубатор и открытые реанимационные системы",
  },
};

// MVP-аватар утверждён в docs/strategy/urania_visual_assets.md.
// Копия assets/urania/urania-avatar-middle-v1.png: Next не резолвит импорты
// выше своего корня. Переедет в S3/CDN на этапе медиа-хранилища.
export const URANIA_AVATAR = "/urania/urania-avatar-middle-v1.png";

// docs/frontend/content_model.md → Urania Assistant Model
export const urania = {
  name: "Urania",
  role: "AI-ассистент VEDAL",
  greeting: "Я помогу найти продукт, документ или передать запрос специалисту.",
  inputPlaceholder: "Напишите вопрос...",
  quickActions: [
    { label: "Подобрать оборудование", href: "/products/" },
    { label: "Найти документ", href: "/documents/" },
    { label: "Запросить КП", href: "/contacts/" },
    { label: "Сервис", href: "/service/" },
  ],
};
