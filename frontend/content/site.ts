// Структурированный контент по docs/frontend/content_model.md.
// Правило из HANDOFF.md: недостающие факты не выдумывать, ставить AWAITING.

export const AWAITING = "ожидает уточнения";

export const site = {
  brand: "VEDAL",
  // Подтверждён бланком датащитов, см. docs/products/README.md.
  phone: "8 800 600 3449",
  phoneHours: "Пн–Пт 9:00–18:00",
  logo: { src: "/brand/vedal-logo.png", width: 461, height: 386 },
};

// CTA шапки по макету заказчика. В hero остаётся «Запросить КП».
export const headerCta = { label: "Связаться с нами", href: "/contacts/" };

// Вкладки действующего сайта vedal-med.ru, переданы заказчиком.
// Отличия от docs/frontend/sitemap.md: нет «Главная» (её роль выполняет логотип)
// и «Партнёры», добавлена «Разработка и технологии», «Пресс-центр» назван «Новости».
export const nav = [
  { label: "О компании", href: "/about/" },
  { label: "Продукция", href: "/products/" },
  { label: "Сервис", href: "/service/" },
  { label: "Разработка и технологии", href: "/technology/" },
  { label: "Производство", href: "/production/" },
  { label: "Документы", href: "/documents/" },
  { label: "Новости", href: "/news/" },
  { label: "Контакты", href: "/contacts/" },
];

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
  // Фото производственного участка из архива заказчика (кадр 164).
  // Сжато до 1600px, оригинал 2000×1331 остаётся у заказчика.
  image: {
    src: "/photos/vedal-production-line.jpg",
    alt: "Производственный участок VEDAL: инкубатор и открытые реанимационные системы",
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
