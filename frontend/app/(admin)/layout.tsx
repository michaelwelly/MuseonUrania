import type { Metadata } from "next";
import { fontVariables } from "../fonts";
import "../globals.css";
import "./admin/admin.css";

// Отдельный корневой layout, а не вложенный в сайтовый.
//
// Причина в том, что вложенный layout не умеет убрать оформление родителя:
// шапка, футер, прелоадер и плавающая Урания приехали бы и в админку. Группы
// маршрутов позволяют иметь два корня — (site) и (admin), — и это единственный
// способ развести их честно, не пряча чужую разметку стилями.
//
// Переход между группами перезагружает страницу целиком. Для пары
// «сайт ↔ админка» это ровно то, что нужно: у них разные шрифтовые наборы,
// разный периметр и разная модель данных.
export const metadata: Metadata = {
  title: "VEDAL Portal — админка",
  description: "Управление каталогом, новостями, документами и заявками.",
  // Админку не индексируем: она закрыта входом, но страница входа
  // в поисковой выдаче не нужна никому.
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={fontVariables}>
      <body className="admin-body">{children}</body>
    </html>
  );
}
