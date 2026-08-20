"use client";

import { useSyncExternalStore } from "react";
import TreeGrow from "./TreeGrow";
import styles from "./LogoPreloader.module.css";

// Прелоадер показывается один раз за сессию: повторные переходы по сайту
// не должны снова закрывать контент. Снимаем после window load + окончания
// анимации, но не дольше 3.6 с — медленная сеть не должна держать экран.
const HOLD_MS = 3400;
const MAX_MS = 3600;
const KEY = "vedal:preloader-shown";

// Показывать ли оверлей, решает sessionStorage, которого при серверном рендере
// нет. Держим ответ во внешнем хранилище и читаем его через
// useSyncExternalStore: серверу отдаётся «не показывать», клиент переспрашивает
// сам после гидратации. Так разметка сервера и первый рендер клиента совпадают,
// а состояние меняется из колбэков таймеров, а не синхронно внутри эффекта.
let visible = false;
let started = false;
const listeners = new Set<() => void>();

function setVisible(next: boolean) {
  if (visible === next) return;
  visible = next;
  for (const listener of listeners) listener();
}

function getSnapshot() {
  return visible;
}

function getServerSnapshot() {
  return false;
}

// Запускается один раз за загрузку страницы, из subscribe — то есть уже на
// клиенте и после гидратации. Повторный вызов (StrictMode монтирует дважды)
// гасится флагом started, иначе второй проход увидел бы выставленный ключ
// сессии и прелоадер не показался бы ни разу.
function ensureStarted() {
  if (started) return;
  started = true;

  if (sessionStorage.getItem(KEY)) return;
  sessionStorage.setItem(KEY, "1");
  setVisible(true);

  const startedAt = performance.now();

  const finish = () => {
    const left = Math.max(0, HOLD_MS - (performance.now() - startedAt));
    window.setTimeout(() => setVisible(false), left);
  };

  if (document.readyState === "complete") finish();
  else window.addEventListener("load", finish, { once: true });

  // Страховка: скрываем, даже если load так и не наступил.
  window.setTimeout(() => setVisible(false), MAX_MS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  ensureStarted();
  return () => {
    listeners.delete(listener);
  };
}

export default function LogoPreloader() {
  const show = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!show) return null;

  return (
    <div className={styles.overlay} role="status" aria-label="Загрузка">
      {/* Знак VEDAL с этого экрана убран: он и так стоит в шапке, которая
          открывается сразу за прелоадером, и показывать его дважды подряд
          незачем. Остаётся дерево — во весь экран, как просил заказчик.

          Размер задан от окна, а не числом: дерево растёт снизу вверх, и
          на этом движении важно, чтобы оно занимало экран целиком. */}
      <TreeGrow size="min(64vmin, 520px)" />
      <div className={styles.track}>
        <div className={styles.bar} />
      </div>
    </div>
  );
}
