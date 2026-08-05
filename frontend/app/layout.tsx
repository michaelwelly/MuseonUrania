import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

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
    <html lang="ru">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
