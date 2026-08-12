// Три шрифта редизайна. Сабсеты latin + cyrillic, чтобы в рантайме не уходили
// запросы на Google Fonts.
//
// Unbounded — заголовки, крупные числа, телефоны, названия изделий. Геометрия
// созвучна начертанию слова VEDAL в логотипе, это и есть причина выбора.
// Commissioner — весь текст, интерфейс, кнопки, поля, навигация.
// JetBrains Mono — служебные подписи: eyebrow, номера, крошки, даты.

import { Unbounded, Commissioner, JetBrains_Mono } from "next/font/google";

export const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

export const commissioner = Commissioner({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const mono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const fontVariables = `${unbounded.variable} ${commissioner.variable} ${mono.variable}`;
