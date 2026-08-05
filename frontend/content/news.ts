// Страница «Новости» по docs/frontend/page_briefs.md → Press Center.
//
// Публикаций нет: материалы Иннопрома, разрешённые фотографии и пресс-контакт
// числятся в «Awaiting NN» и в docs/requests/nikolay_materials_request.md.
// Выдуманных новостей здесь быть не должно, поэтому список пустой,
// а страница честно показывает, чего ждём.

import { AWAITING } from "./site";

export const newsHero = {
  eyebrow: "Новости",
  headline: "Новости и пресс-центр",
  lead: "Здесь будут публикации о выставках, выпуске изделий и событиях компании.",
};

export type NewsItem = { date: string; title: string; excerpt: string; href?: string };

/** Пусто до передачи материалов. Первая запись — релиз по Иннопрому. */
export const news: NewsItem[] = [];

export const expected = [
  `Пресс-релиз и материалы с Иннопрома — ${AWAITING}.`,
  `Фотографии со стенда, разрешённые к публикации, — ${AWAITING}.`,
  `Медиакит и пресс-контакт — ${AWAITING}.`,
];

export const newsNotice = {
  title: "Для СМИ",
  text: "Запросы на комментарии, материалы и съёмку принимаются по общим контактам компании. Отдельный пресс-контакт будет указан после согласования.",
};
