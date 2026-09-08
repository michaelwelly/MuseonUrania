import { ui } from "@/content/ui";
import { DEFAULT_LANG, type Lang } from "@/lib/i18n";
import styles from "./TranslationNotice.module.css";

// Примечание о непереведённом.
//
// Оно нужно ровно потому, что мы не переводим содержательные тексты сами.
// Посетитель английской версии видит абзац кириллицей и должен понимать,
// почему: не «сайт сломался» и не «страница недоделана», а «перевод этого
// куска ещё не согласован производителем».
//
// Молча показывать русский текст на английской странице нельзя — это
// выглядит ошибкой. Переводить его машинно нельзя тем более: правила
// контента (CLAUDE.md) запрещают выдумывать характеристики, сертификаты
// и статус регистрации, а перевод такой формулировки — её новая редакция.

type Props = {
  lang: Lang;
  /** `legal` — для страниц с юридическим текстом: там формулировка жёстче. */
  kind?: "page" | "legal";
};

export default function TranslationNotice({ lang, kind = "page" }: Props) {
  if (lang === DEFAULT_LANG) return null;

  const text = ui(lang).fallback[kind];
  if (!text) return null;

  return (
    <p className={styles.notice} role="note">
      {text}
    </p>
  );
}
