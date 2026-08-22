import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VedalinaWidget from "@/components/VedalinaWidget";
import CookieNotice from "@/components/CookieNotice";
import ImageGuard from "@/components/ImageGuard";
import LogoPreloader from "@/components/LogoPreloader";
import Motion from "@/components/Motion";
import { siteSeo } from "@/content/site";
import { siteUrl } from "@/lib/seo";
import { fontVariables } from "../fonts";
import "../globals.css";
import "../motion.css";

// Метаданные слоя: только то, что общее для всех страниц. Заголовок
// и описание здесь запасные — свои есть у каждой страницы, включая главную.
export const metadata: Metadata = {
  // База для абсолютных адресов. Без неё canonical и og:url остаются
  // относительными, а мессенджер и поисковик разбирают такой адрес каждый
  // по-своему — обычно относительно собственного домена.
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: siteSeo.title,
  description: siteSeo.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Та же причина, что и в админке: расширения браузера дописывают свои
    // атрибуты в <html> и <body> раньше, чем отрисуется React. Подавление
    // действует только на атрибуты этих узлов и не распространяется на детей —
    // расхождение внутри страницы отловится как обычно.
    <html lang="ru" className={fontVariables} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <LogoPreloader />
        <Motion />
        <div className="frame">
          <Header />
          {children}
        </div>
        <Footer />
        {/* Плавающий чат — на всех страницах */}
        <VedalinaWidget />
        <CookieNotice />
        <ImageGuard />
      </body>
    </html>
  );
}
