import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VedalinaWidget from "@/components/VedalinaWidget";
import CookieNotice from "@/components/CookieNotice";
import Analytics from "@/components/Analytics";
import ImageGuard from "@/components/ImageGuard";
import LogoPreloader from "@/components/LogoPreloader";
import Motion from "@/components/Motion";
import LangPreference from "@/components/LangPreference";
import { fontVariables } from "@/app/fonts";
import { htmlLang, type Lang } from "@/lib/i18n";

// Оболочка публичного сайта: `<html>`, `<body>` и всё, что стоит на каждой
// странице. Вынесена из layout'а, потому что layout'ов теперь два.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему два корневых layout'а, а не один с сегментом языка
//
// Атрибут `lang` у `<html>` обязан меняться вместе с языком страницы: от него
// зависит переносы, подбор шрифта, произношение в скринридере и то, предложит
// ли браузер перевод. Ставит `<html>` корневой layout — а вложить сегмент
// `[lang]` внутрь существующего `app/(site)/layout.tsx` нельзя: вложенный
// layout нарисовал бы второй `<html>` внутри первого.
//
// Поэтому русская версия остаётся в `app/(site)`, переведённые живут в
// `app/(intl)/[lang]`, и у каждой группы свой корень. Это документированный
// приём Next, а не обход: несколько корневых layout'ов через группы
// маршрутов. В проекте он уже применён — админка `app/(admin)` тоже
// корневая и оформление сайта в неё не приезжает.
//
// Плата известна: переход между русской и английской версией — полная
// перезагрузка страницы, а не клиентский переход. Для смены языка это
// уместно: меняется вся страница целиком, включая шапку и подвал.

export default function SiteShell({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    // Та же причина, что и в админке: расширения браузера дописывают свои
    // атрибуты в <html> и <body> раньше, чем отрисуется React. Подавление
    // действует только на атрибуты этих узлов и не распространяется на детей —
    // расхождение внутри страницы отловится как обычно.
    <html lang={htmlLang[lang]} className={fontVariables} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Ничего не рисует: помнит выбор языка и уводит на него с русских
            адресов. Стоит первым, чтобы решение принималось до того, как
            посетитель начал читать не тот язык. */}
        <LangPreference lang={lang} />
        <LogoPreloader />
        <Motion />
        <div className="frame">
          <Header lang={lang} />
          {children}
        </div>
        <Footer lang={lang} />
        {/* Плавающий чат — на всех страницах. Ведалина отвечает на языке
            вопроса (backend/assistant/Guardrails), интерфейс виджета пока
            русский — отмечено в issue #54 отдельным пунктом. */}
        <VedalinaWidget />
        <CookieNotice />
        {/* Счётчик Метрики: молчит, пока не задан номер и не дано согласие. */}
        <Analytics />
        <ImageGuard />
      </body>
    </html>
  );
}
