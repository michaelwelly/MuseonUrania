// Структурированный контент по docs/frontend/content_model.md.
// Правило из HANDOFF.md: недостающие факты не выдумывать, ставить AWAITING.

export const AWAITING = "ожидает уточнения";

export const site = {
  brand: "VEDAL",
  // Взят из prototypes/urania-web-interface.html. Требует подтверждения НН
  // (docs/frontend/page_briefs.md, раздел «Контакты»).
  phone: "8 800 600 3449",
};

// docs/frontend/sitemap.md → Global Navigation
export const nav = [
  { label: "Главная", href: "/" },
  { label: "Продукция", href: "/products/" },
  { label: "Производство", href: "/production/" },
  { label: "Документы", href: "/documents/" },
  { label: "Пресс-центр", href: "/press/" },
  { label: "Партнёры", href: "/partners/" },
  { label: "Сервис", href: "/service/" },
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
  // Нужно утверждённое фото производства/продукции (page_briefs.md → Awaiting NN).
  // Сгенерированный urania-web-integration-mockup-v1.png — только референс
  // направления, в UI не идёт (urania_assistant_spec.md, urania_visual_assets.md).
  image: null,
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
