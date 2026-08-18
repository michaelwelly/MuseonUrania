import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VedalinaWidget from "@/components/VedalinaWidget";
import LogoPreloader from "@/components/LogoPreloader";
import Motion from "@/components/Motion";
import { fontVariables } from "../fonts";
import "../globals.css";
import "../motion.css";

// seo_title / seo_description в content_model.md помечены как awaiting NN answer.
// До согласования держим только факты из page_briefs.md, без заявлений о
// сертификации, ценах и клинических свойствах.
export const metadata: Metadata = {
  title: "VEDAL — российское медицинское оборудование",
  description:
    "Собственное производство и современные решения для неонатологии, реанимации, анестезиологии и интенсивной терапии.",
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
      </body>
    </html>
  );
}
