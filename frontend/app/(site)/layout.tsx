import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import { ui } from "@/content/ui";
import { DEFAULT_LANG } from "@/lib/i18n";
import { siteUrl } from "@/lib/seo";
import "../globals.css";
import "../motion.css";

// Русская версия сайта: корень без языкового префикса.
//
// Русский ведущий (правило 3 в CLAUDE.md) и потому стоит в корне: адреса
// `/products/`, `/about/` уже разошлись по письмам и презентациям, и переезд
// на `/ru/` сделал бы редирект из каждой такой ссылки. Английская и
// китайская версии живут в `app/(intl)/[lang]` со своим корневым layout'ом —
// почему так, написано в `components/SiteShell.tsx`.

// Метаданные слоя: только то, что общее для всех страниц. Заголовок
// и описание здесь запасные — свои есть у каждой страницы, включая главную.
export const metadata: Metadata = {
  // База для абсолютных адресов. Без неё canonical и og:url остаются
  // относительными, а мессенджер и поисковик разбирают такой адрес каждый
  // по-своему — обычно относительно собственного домена.
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: ui(DEFAULT_LANG).meta.siteTitle,
  description: ui(DEFAULT_LANG).meta.siteDescription,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <SiteShell lang={DEFAULT_LANG}>{children}</SiteShell>;
}
