/**
 * Временное решение заказчика: публичная витрина документов скрыта.
 * Файлы, карточки и административный раздел при этом остаются на месте.
 * Чтобы вернуть витрину, достаточно собрать сайт с
 * NEXT_PUBLIC_DOCUMENTS_ENABLED=true.
 */
export const publicDocumentsEnabled =
  process.env.NEXT_PUBLIC_DOCUMENTS_ENABLED === "true";

export function isPublicLinkVisible(link: { href: string }): boolean {
  return publicDocumentsEnabled || link.href !== "/documents/";
}
