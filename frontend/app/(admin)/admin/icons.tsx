// Знаки оболочки.
//
// Один файл, а не по месту использования: лупа стоит в шапке и в окне поиска,
// стрелка — на кнопке «Открыть сайт» и в подсказках, крест закрывает четыре
// разных всплывающих окна. Разъехавшись по файлам, они разъезжаются и по
// толщине штриха: замер на сайте до сведения давал 1.5, 1.6, 1.8 и 2 в одной
// шапке.
//
// Штрих 1.8 и `stroke-linecap: square` — то же, чем набраны знаки сайта.
// Размер задаётся снаружи: один и тот же знак стоит и в кнопке 40 пикселей,
// и в строке подсказки.

type Props = { size?: number };

/** Общая обёртка: одна точка, где живут штрих и торцы. */
function Glyph({ size = 18, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="square"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function SearchIcon({ size }: Props) {
  return (
    <Glyph size={size}>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5 20 20" />
    </Glyph>
  );
}

export function BellIcon({ size }: Props) {
  return (
    <Glyph size={size}>
      <path d="M6 10a6 6 0 0 1 12 0v4l2 3H4l2-3v-4Z" />
      <path d="M10 20h4" />
    </Glyph>
  );
}

export function ExitIcon({ size }: Props) {
  return (
    <Glyph size={size}>
      <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
      <path d="M17 8l4 4-4 4M21 12H10" />
    </Glyph>
  );
}

export function ArrowIcon({ size = 15 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M2 8h11M9 4l4 4-4 4" />
    </svg>
  );
}

export function CloseIcon({ size = 16 }: Props) {
  return (
    <Glyph size={size}>
      <path d="M5 5l14 14M19 5 5 19" />
    </Glyph>
  );
}

/** Знак-крест VEDAL: тот же, что на кнопке Ведалины у посетителя. */
export function CrossIcon({ size = 20 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.6 2h4.8v7.6H22v4.8h-7.6V22H9.6v-7.6H2V9.6h7.6V2Z" />
    </svg>
  );
}
