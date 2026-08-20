import Image from "next/image";
import styles from "./LivePattern.module.css";

/**
 * Живой паттерн VEDAL — фоновая графика полос.
 *
 * Заменил прежнюю фактуру из крестиков (утилита crossField в globals.css):
 * та тайлила один знак в три слоя на 6% прозрачности и читалась серой рябью.
 * Здесь другой приём — не текстура, а композиция: бледная решётка #e0f9dc
 * с вырезами и несколько насыщенных квадратов #17af2c, стоящих в этих
 * вырезах. Формы те же, что у знака VEDAL, — это по-прежнему одна система
 * знаков, просто нарисованная нормально.
 *
 * ————— почему без JS —————
 *
 * Движение целиком на CSS-анимациях: компонент серверный, в браузер не едет
 * ни байта скрипта. Расфазировка сделана отрицательным animation-delay —
 * каждый квадрат стартует с середины своего цикла, поэтому они не пульсируют
 * в такт с первого кадра и без синхронизации таймеров.
 *
 * ————— почему композиция, а не тайл —————
 *
 * Паттерн нельзя размножать плиткой: у решётки и квадратов фиксированные
 * относительные позиции, при повторении стык виден. Поэтому он ставится
 * одним пятном, прижатым к правому краю полосы, — там, где в макетах пусто
 * или стоит фото. Под текст паттерн не заводится: §11.1 плана запрещает
 * класть фактуру под мелкий текст.
 *
 * Темп из motion-спеки пакета: решётка дышит целиком (сдвиг 2 px, масштаб
 * ×1.012–1.015, период 21–24 с), квадраты пульсируют каждый со своим
 * периодом 7–10 с. Считывается, если задержать взгляд на несколько секунд,
 * а не при беглом скролле.
 */

type Variant = 1 | 2;

type Square = {
  /** Все координаты в процентах от коробки паттерна — как в спеке пакета. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Период пульсации, с. */
  period: number;
  /** Отрицательный сдвиг старта, с: расфазировка. */
  delay: number;
  /** Пиковый масштаб. */
  scale: number;
};

// Позиции и тайминги перенесены из «Живой паттерн VEDAL (offline).html»,
// режим «subtle» — он в пакете стоит по умолчанию. Файлы квадратов идут
// в том же порядке: их размеры совпадают с процентами до пикселя
// (42px / 501px = 8.38%, и так все одиннадцать).
const SQUARES: Record<Variant, Square[]> = {
  1: [
    { left: 30.54, top: 9.73, width: 8.38, height: 9.5, period: 9, delay: -1, scale: 1.03 },
    { left: 63.27, top: 11.99, width: 12.18, height: 13.8, period: 8, delay: -4, scale: 1.04 },
    { left: 52.1, top: 24.66, width: 11.98, height: 13.8, period: 10, delay: -6, scale: 1.035 },
    { left: 23.95, top: 50.68, width: 11.78, height: 13.35, period: 7, delay: -2, scale: 1.045 },
    { left: 44.11, top: 61.31, width: 8.38, height: 9.5, period: 9, delay: -5, scale: 1.03 },
    { left: 62.08, top: 77.15, width: 10.98, height: 12.22, period: 8, delay: -3, scale: 1.04 },
    { left: 19.36, top: 88.91, width: 4.99, height: 5.66, period: 9, delay: -2.5, scale: 1.032 },
  ],
  2: [
    { left: 23.82, top: 18.63, width: 9.01, height: 9.31, period: 8, delay: -2, scale: 1.038 },
    { left: 76.18, top: 21.73, width: 13.09, height: 13.53, period: 9, delay: -5, scale: 1.03 },
    { left: 64.16, top: 34.15, width: 13.09, height: 13.53, period: 7, delay: -1, scale: 1.045 },
    { left: 35.41, top: 76.94, width: 11.59, height: 12.2, period: 10, delay: -4, scale: 1.035 },
  ],
};

// Дыхание решётки: период, сдвиг и масштаб у двух вариантов разные, чтобы
// две полосы на одной странице не качались синхронно.
const NET: Record<Variant, { period: number; delay: number; dx: string; dy: string; scale: number }> = {
  1: { period: 24, delay: -4, dx: "2px", dy: "-2px", scale: 1.015 },
  2: { period: 21, delay: -10, dx: "-2px", dy: "2px", scale: 1.012 },
};

type Props = {
  /** Какая из двух присланных композиций. */
  variant?: Variant;
  /**
   * Тёмная полоса: решётка приглушается, квадраты не рисуются вовсе.
   * На почти чёрном фоне бледная решётка и так заметна, а насыщенный
   * зелёный квадрат превращается в световое пятно и тянет взгляд
   * сильнее, чем текст рядом.
   */
  tone?: "light" | "dark";
  /**
   * Где стоит композиция.
   *
   * `edge` — прижата к правому краю полосы. Годится там, где правая часть
   * свободна: первые экраны внутренних страниц.
   *
   * `seam` — в стыке между текстом и фотографией, правым краем под снимок.
   * Для полос, где правую половину занимает фото: у края там встать негде,
   * композиция ушла бы под снимок целиком. Долю, которую занимает фото,
   * страница передаёт через CSS-переменную --pattern-seam.
   */
  placement?: "edge" | "seam";
};

export default function LivePattern({
  variant = 1,
  tone = "light",
  placement = "edge",
}: Props) {
  const net = NET[variant];
  const dark = tone === "dark";

  return (
    <span
      className={`${styles.pattern} ${dark ? styles.dark : ""} ${
        placement === "seam" ? styles.seam : ""
      }`}
      aria-hidden="true"
      data-variant={variant}
    >
      <span
        className={styles.net}
        style={
          {
            "--period": `${net.period}s`,
            "--delay": `${net.delay}s`,
            "--dx": net.dx,
            "--dy": net.dy,
            "--sc": net.scale,
          } as React.CSSProperties
        }
      >
        <Image
          src={`/brand/pattern/p${variant}-network.png`}
          alt=""
          fill
          sizes="(max-width: 900px) 60vw, 40vw"
        />
      </span>

      {!dark &&
        SQUARES[variant].map((s, i) => (
          <span
            key={i}
            className={styles.square}
            style={
              {
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: `${s.width}%`,
                height: `${s.height}%`,
                "--period": `${s.period}s`,
                "--delay": `${s.delay}s`,
                "--sc": s.scale,
              } as React.CSSProperties
            }
          >
            <Image
              src={`/brand/pattern/p${variant}-square-${i + 1}.png`}
              alt=""
              fill
              sizes="80px"
            />
          </span>
        ))}
    </span>
  );
}
