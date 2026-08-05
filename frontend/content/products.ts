// Каталог продукции.
//
// Позиции с status: "confirmed" описаны по официальным датащитам ООО «ВЕДАЛ»
// (docs/products/). Позиции с status: "pending" взяты из перечня в
// docs/strategy/functional_requirements.md — он собран по публичному сайту и,
// как там же сказано, требует сверки с каталогом НН: в брифе речь про «около
// 10 продуктов», а именованных позиций больше. Ни характеристик, ни описаний
// для них не выдумываем.

import { AWAITING } from "./site";

// docs/frontend/page_briefs.md → Products → Categories
export const categories = [
  "Неонатология",
  "Реанимация",
  "Анестезиология",
  "Мониторинг",
  "Интенсивная терапия",
] as const;

export type Category = (typeof categories)[number];

export type Product = {
  slug: string;
  name: string;
  kind: string;
  categories: Category[];
  status: "confirmed" | "pending";
  summary: string;
  image?: { src: string; alt: string };
};

export const products: Product[] = [
  {
    slug: "vedal-r1-r2",
    name: "VEDAL R1, R2",
    kind: "Системы реанимационные для новорождённых",
    categories: ["Реанимация", "Неонатология"],
    status: "confirmed",
    summary:
      "Открытые реанимационные системы: круговой доступ к ребёнку, лучистый обогрев в ручном или сервоконтролируемом режиме, встроенные весы и пульсоксиметрия. У R2 дополнительно ЖК-дисплей, фототерапия, аспиратор и блок респираторной поддержки.",
    image: {
      src: "/photos/products/vedal-r1-r2.jpg",
      alt: "Открытая реанимационная система VEDAL",
    },
  },
  {
    slug: "vedal-a-2000",
    name: "VEDAL A-2000",
    kind: "Инкубатор-трансформер",
    categories: ["Неонатология", "Интенсивная терапия"],
    status: "confirmed",
    summary:
      "Совмещает инкубатор закрытого типа и открытую реанимационную систему. Переход между режимами электромеханическими приводами, без перекладывания новорождённого. Каналы мониторинга: пульсоксиметрия, ЭКГ, дыхание, НИАД, капнометрия.",
    image: {
      src: "/photos/products/vedal-a-2000.jpg",
      alt: "Инкубатор-трансформер VEDAL A-2000",
    },
  },
  {
    slug: "vedal-t-100",
    name: "VEDAL Т-100",
    kind: "Система терморегулирующая",
    categories: ["Неонатология", "Интенсивная терапия"],
    status: "confirmed",
    summary:
      "Прокачивает подогретую или охлаждённую воду в терморегулирующее одеяло и удерживает температуру по показаниям датчиков пациента. Диапазон регулирования жидкости 12–39 °C, два размера одеял.",
    image: {
      src: "/photos/products/vedal-t-100.jpg",
      alt: "Система терморегулирующая VEDAL Т-100",
    },
  },
  {
    slug: "vedal-vv11",
    name: "VEDAL VV11",
    kind: "Аппарат искусственной вентиляции лёгких",
    categories: ["Реанимация", "Интенсивная терапия"],
    status: "pending",
    summary: AWAITING,
  },
  {
    slug: "vedal-vp4",
    name: "VEDAL VP4",
    kind: "Портативный аппарат ИВЛ для интенсивной терапии",
    categories: ["Интенсивная терапия"],
    status: "pending",
    summary: AWAITING,
  },
  {
    slug: "vedal-vn10",
    name: "VEDAL VN10",
    kind: "Портативный неонатальный аппарат ИВЛ",
    categories: ["Неонатология", "Реанимация"],
    status: "pending",
    summary: AWAITING,
  },
  {
    slug: "vedal-n6",
    name: "VEDAL N6",
    kind: "Аппарат ингаляционной анестезии",
    categories: ["Анестезиология"],
    status: "pending",
    summary: AWAITING,
  },
  {
    slug: "vedal-n12",
    name: "VEDAL N12",
    kind: "Монитор пациента",
    categories: ["Мониторинг"],
    status: "pending",
    summary: AWAITING,
  },
  {
    slug: "vedal-n15",
    name: "VEDAL N15",
    kind: "Монитор пациента",
    categories: ["Мониторинг"],
    status: "pending",
    summary: AWAITING,
  },
  {
    slug: "vedal-n1",
    name: "VEDAL N1",
    kind: "Инкубатор для новорождённых",
    categories: ["Неонатология"],
    status: "pending",
    summary: AWAITING,
  },
  {
    slug: "vedal-n2",
    name: "VEDAL N2",
    kind: "Инкубатор для новорождённых",
    categories: ["Неонатология"],
    status: "pending",
    summary: AWAITING,
  },
  {
    slug: "vedal-n3",
    name: "VEDAL N3",
    kind: "Инкубатор для новорождённых",
    categories: ["Неонатология"],
    status: "pending",
    summary: AWAITING,
  },
];

export const statusLabel: Record<Product["status"], string> = {
  confirmed: "Документация подтверждена",
  pending: "Ожидает уточнения",
};
