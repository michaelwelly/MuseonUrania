import { SHAPES } from "@/content/pattern-shapes";
import { buildField } from "@/lib/brand-pattern";
import styles from "./BrandPattern.module.css";

/**
 * Фирменный узор VEDAL.
 *
 * ————— почему разметкой, а не картинкой —————
 *
 * Прошлая версия ставила фрагменты отдельными `<img>` из `/public`: поле
 * из полусотни фигур давало полсотни запросов, и на стенде это оборачивалось
 * пятисотыми — шлюз рвал соединение к Next, не дождавшись картинок. Здесь
 * узор — часть разметки страницы: ни одного запроса, ни байта скрипта,
 * раскладка посчитана на сборке.
 *
 * ————— почему формы собраны из клеток —————
 *
 * Каждая фигура — несколько скруглённых квадратов на модульной сетке
 * (content/pattern-shapes.ts). Так устроен и сам знак: в брошюре формы
 * сложены из квадратов, приставленных углами. Собранная так фигура остаётся
 * чистой на любом размере — а фрагменты, присланные заказчиком и обведённые
 * в вектор автоматически, на двухстах пикселях показывали рваный край:
 * контур там идёт ступеньками по одному пикселю.
 *
 * ————— про доступность —————
 *
 * `aria-hidden`: для читающего с экрана это шум. Ни одна фигура не сообщает
 * ничего, что не было бы сказано словами рядом.
 */

type Props = {
  /** Зерно раскладки: разные места сайта — разные зёрна. */
  seed: number;
  width?: number;
  height?: number;
  /** Доля занятых гнёзд в мелком узоре: меньше — больше воздуха. */
  density?: number;
  /** Крупность: 1 — поле мелких знаков, 3 — несколько больших форм. */
  boldness?: number;
  /** Прямоугольники, свободные от фигур: место текста и полоса шапки. */
  keepClear?: readonly { x1?: number; x2: number; y1: number; y2: number; strict?: boolean }[];
  /** На тёмной подложке светлые формы уходят в прозрачность. */
  tone?: "light" | "dark";
};

export default function BrandPattern({
  seed,
  width = 900,
  height = 700,
  density = 1,
  boldness = 1,
  keepClear,
  tone = "light",
}: Props) {
  const field = buildField({ width, height, seed, keepClear, density, boldness });

  return (
    <svg
      className={`${styles.pattern} ${tone === "dark" ? styles.dark : ""}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {field.map((p, i) => {
        const shape = SHAPES[p.id];
        // Форма нарисована в своих координатах (viewBox файла), а стоит
        // в координатах поля — разницу и снимает масштаб. Меньшая из двух
        // долей: иначе фигура вылезла бы за собственную коробку, и место
        // под неё считалось бы не там, где она нарисована.
        const k = Math.min(p.w / shape.w, p.h / shape.h);
        return (
          <g
            key={`${p.id}-${i}`}
            className={styles[p.ink]}
            /* fill на группе, а не на пути: цвет — свойство фигуры целиком,
               и на тёмной подложке он меняется одним классом. */
            fill="currentColor"
            transform={[
              `translate(${Math.round(p.x)} ${Math.round(p.y)})`,
              p.turn ? `rotate(${p.turn} ${Math.round(p.w / 2)} ${Math.round(p.h / 2)})` : "",
              p.mirror ? `translate(${Math.round(p.w)} 0) scale(-1 1)` : "",
              `scale(${k.toFixed(3)})`,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <path d={shape.d} fillRule="evenodd" />
          </g>
        );
      })}
    </svg>
  );
}
