import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import { ui } from "@/content/ui";
import { siteUrl } from "@/lib/seo";
import "../globals.css";
import "../motion.css";

// Корневой layout публичного сайта. Второй корневой — у админки
// (`app/(admin)`): оформление сайта в неё не приезжает, а `<html>` рисует
// ровно один из двух. Разметка оболочки — в `components/SiteShell.tsx`.

// Метаданные слоя: только то, что общее для всех страниц. Заголовок
// и описание здесь запасные — свои есть у каждой страницы, включая главную.
export const metadata: Metadata = {
  // База для абсолютных адресов. Без неё canonical и og:url остаются
  // относительными, а мессенджер и поисковик разбирают такой адрес каждый
  // по-своему — обычно относительно собственного домена.
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: ui.meta.siteTitle,
  description: ui.meta.siteDescription,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <SiteShell>{children}</SiteShell>;
}
