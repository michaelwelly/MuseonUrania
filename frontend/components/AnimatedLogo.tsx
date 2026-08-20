"use client";

import { useState } from "react";
import styles from "./AnimatedLogo.module.css";

// Анимированный знак VEDAL вместо статичного Image в Header.tsx.
// Знак собирается один раз и остаётся неподвижным. При наведении сборка
// проигрывается заново — смена key ремонтирует слои, поэтому CSS-анимации
// стартуют сначала.
type Props = {
  /** Высота знака в px. В шапке 60 (Header.module.css), в футере 40. */
  height?: number;
  className?: string;
};

// Пропорции исходника public/brand/vedal-logo.png: 461 × 386.
const RATIO = 461 / 386;

// Играет один раз при монтировании и держит собранный знак неподвижным —
// без повторного скрытия при наведении или ремонтировании.
export default function AnimatedLogo({ height = 60, className }: Props) {
  const [run] = useState(0);

  return (
    <span
      className={className ? `${styles.wrap} ${className}` : styles.wrap}
      style={{ width: height * RATIO, height }}
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
