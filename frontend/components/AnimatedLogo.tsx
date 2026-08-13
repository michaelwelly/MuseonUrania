"use client";

import { useState } from "react";
import styles from "./AnimatedLogo.module.css";

// Анимированный знак VEDAL вместо статичного Image в Header.tsx.
// Цикл 5.4 с: знак собирается, держится, стирается за курсором и собирается
// снова. При наведении цикл запускается с начала — смена key ремонтирует
// слои, поэтому CSS-анимации стартуют заново.
type Props = {
  /** Высота знака в px. В шапке 60 (Header.module.css), в футере 40. */
  height?: number;
  /** Запускать цикл заново при наведении. */
  replayOnHover?: boolean;
  className?: string;
};

// Пропорции исходника public/brand/vedal-logo.png: 461 × 386.
const RATIO = 461 / 386;

export default function AnimatedLogo({ height = 60, replayOnHover = true, className }: Props) {
  const [run, setRun] = useState(0);

  return (
    <span
      className={className ? `${styles.wrap} ${className}` : styles.wrap}
      style={{ width: height * RATIO, height }}
      onMouseEnter={replayOnHover ? () => setRun((n) => n + 1) : undefined}
      aria-hidden="true"
    >
      <span key={run} className={styles.settle}>
        <span className={`${styles.layer} ${styles.guideH}`} />
        <span className={`${styles.layer} ${styles.guideV}`} />
        <span className={`${styles.layer} ${styles.cross}`} />
        <span className={`${styles.layer} ${styles.word}`} />
        <span className={`${styles.layer} ${styles.cursor}`} />
      </span>
    </span>
  );
}
