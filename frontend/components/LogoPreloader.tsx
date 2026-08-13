"use client";

import { useEffect, useState } from "react";
import AnimatedLogo from "./AnimatedLogo";
import styles from "./LogoPreloader.module.css";

// Прелоадер показывается один раз за сессию: повторные переходы по сайту
// не должны снова закрывать контент. Снимаем после window load + окончания
// анимации, но не дольше 3.6 с — медленная сеть не должна держать экран.
const HOLD_MS = 3400;
const MAX_MS = 3600;
const KEY = "vedal:preloader-shown";

export default function LogoPreloader() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, "1");
    setShow(true);

    const start = performance.now();
    let timer: number;

    const finish = () => {
      const left = Math.max(0, HOLD_MS - (performance.now() - start));
      timer = window.setTimeout(() => setShow(false), left);
    };

    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });

    const hardStop = window.setTimeout(() => setShow(false), MAX_MS);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(hardStop);
      window.removeEventListener("load", finish);
    };
  }, []);

  if (!show) return null;

  return (
    <div className={styles.overlay} role="status" aria-label="Загрузка">
      <AnimatedLogo height={160} replayOnHover={false} />
      <div className={styles.track}>
        <div className={styles.bar} />
      </div>
    </div>
  );
}
