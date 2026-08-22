import type { Session } from "@/lib/admin";

// Кто куда пущен — со стороны интерфейса.
//
// Правило одно и то же по обе стороны, но задачи у него разные. На портале
// оно ЗАЩИЩАЕТ: там правила безопасности, и обойти их нельзя. Здесь оно
// ОБЪЯСНЯЕТ: показывать кнопку, которая приведёт к отказу, — значит врать
// человеку дважды, сначала предложив, потом отказав.
//
// Поэтому здесь нельзя ослабить защиту, но можно рассинхронизировать смысл:
// раздел, забытый в этом файле, просто не покажется тому, кому он положен.
// Ошибка заметная, а не тихая, и это правильная сторона для ошибки.

/** Роли realm'а. Ровно те же строки, что раздаёт Keycloak. */
export const ADMIN = "portal-admin";
export const SALES = "portal-sales";
export const PRODUCTION = "portal-production";

/**
 * Контур — не «уровень доступа», а предмет работы.
 *
 * У продавца и у того, кто ведёт сайт, разные ПРЕДМЕТЫ, а не разная глубина
 * доступа к одному предмету. Поэтому деление не «читатель/редактор»,
 * а «клиенты/содержимое».
 */
export type Contour = "sales" | "production" | "admin" | "any";

/** Кому открыт контур. Администратор — везде. */
export function may(who: Session, contour: Contour): boolean {
  const roles = who.roles ?? [];
  if (roles.includes(ADMIN)) return true;

  switch (contour) {
    case "any":
      return roles.includes(SALES) || roles.includes(PRODUCTION);
    case "sales":
      return roles.includes(SALES);
    case "production":
      return roles.includes(PRODUCTION);
    case "admin":
      return false;
  }
}

// Адреса админки по контурам. Порядок важен: сначала более длинные пути.
// «/admin/staff/» лежит внутри «Команды», но это административный справочник,
// а «/admin/profile/» рядом — свой профиль, и он нужен всем.
const CONTOURS: ReadonlyArray<readonly [string, Contour]> = [
  ["/admin/leads", "sales"],
  ["/admin/clients", "sales"],
  ["/admin/deals", "sales"],
  ["/admin/quotes", "sales"],
  ["/admin/chats", "sales"],
  ["/admin/analytics", "sales"],

  ["/admin/products", "production"],
  ["/admin/categories", "production"],
  ["/admin/news", "production"],
  ["/admin/documents", "production"],

  ["/admin/audit", "admin"],
  ["/admin/staff", "admin"],

  ["/admin/profile", "any"],
];

/**
 * К какому контуру относится адрес.
 *
 * Неизвестный адрес — «any». Сводка, страница возврата из Keycloak и всё,
 * что появится завтра, не должны запираться этим файлом: запирает портал,
 * а здесь мы только не показываем лишнего. Забытый адрес, закрытый на всякий
 * случай, выглядел бы как поломка ровно у того, кто прав.
 */
export function contourOf(path: string): Contour {
  const found = CONTOURS.find(([prefix]) => path === prefix || path.startsWith(prefix + "/"));
  return found ? found[1] : "any";
}

/** Пущен ли этот человек на эту страницу. */
export function mayOpen(who: Session, path: string): boolean {
  return may(who, contourOf(path));
}

/** Как назвать контур человеку. Для отказа: он должен понять, чего у него нет. */
export function contourName(contour: Contour): string {
  switch (contour) {
    case "sales":
      return "работе с клиентами";
    case "production":
      return "содержимому сайта";
    case "admin":
      return "административным разделам";
    case "any":
      return "админке";
  }
}
