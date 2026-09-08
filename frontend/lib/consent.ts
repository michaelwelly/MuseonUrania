// Согласие посетителя на аналитические cookie.
//
// Одно хранилище на двоих: плашка (`CookieNotice`) спрашивает, счётчик
// (`Analytics`) смотрит на ответ. Держать это в компоненте нельзя — они
// в разных ветках дерева, и «принять» должно гасить плашку и поднимать
// счётчик одновременно, без перезагрузки страницы.
//
// ————— почему localStorage, а не cookie —————
//
// Для плашки про cookie звучит смешно, но так честнее: cookie уезжает
// на сервер с каждым запросом, localStorage не уезжает никуда. Спросить
// разрешение и в ответ на согласие завести лишнюю передачу данных —
// плохая шутка.

import { metrikaId } from "./analytics";

/**
 * Ответ на плашку «cookie нужны, чтобы страницы работали».
 *
 * Остался с той поры, когда счётчиков не было и спрашивать было не о чем:
 * плашка только сообщала. Ключ сохранён, чтобы не показывать её заново
 * тем, кто уже нажал «Понятно», — но ответом на вопрос про аналитику
 * он НЕ считается, см. {@link readConsent}.
 */
const NOTICE_KEY = "vedal.cookies.v1";

/** Ответ на вопрос про аналитику: `granted` или `denied`. */
const ANALYTICS_KEY = "vedal.analytics.v1";

export type Consent =
  /** Ответ ещё не прочитан: серверная отрисовка или недоступное хранилище. */
  | "unknown"
  /** Не спрашивали или спрашивали о другом — плашку показываем. */
  | "unanswered"
  /** Ответил: только необходимые. Счётчик не подключается. */
  | "necessary"
  /** Ответил: аналитика разрешена. Счётчик подключается. */
  | "analytics";

const SERVER: Consent = "unknown";

// Событие `storage` в своей же вкладке не срабатывает, поэтому подписчиков
// зовём сами. Иначе нажатие на кнопку не убрало бы плашку.
const listeners = new Set<() => void>();

export function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function readConsent(): Consent {
  let notice: string | null;
  let analytics: string | null;
  try {
    notice = localStorage.getItem(NOTICE_KEY);
    analytics = localStorage.getItem(ANALYTICS_KEY);
  } catch {
    // Приватный режим или заблокированное хранилище: ответ сохранить некуда,
    // и плашка возвращалась бы на каждой странице. Раздражать этим хуже,
    // чем не спросить про cookie, без которых сайт не работает. Счётчик при
    // таком ответе тоже не поднимается — молчание согласием не считается.
    return SERVER;
  }

  // Счётчика нет — вопроса про аналитику нет. Плашка только сообщает,
  // и старого «Понятно» для неё достаточно.
  if (!metrikaId) return notice ? "necessary" : "unanswered";

  // Счётчик есть — засчитывается только явный ответ про аналитику.
  // Тот, кто в своё время нажал «Понятно» на плашке без выбора, ответил
  // на другой вопрос: тогда передавать было нечего и некому.
  if (analytics === "granted") return "analytics";
  if (analytics === "denied") return "necessary";
  return "unanswered";
}

/** Серверный снимок: на сервере хранилища нет, и ответ неизвестен. */
export const readServerConsent = (): Consent => SERVER;

function save(entries: [string, string][]): void {
  try {
    for (const [key, value] of entries) localStorage.setItem(key, value);
  } catch {
    // Сюда не попадаем: при недоступном хранилище плашки нет вовсе.
  }
  listeners.forEach((notify) => notify());
}

/**
 * Ответ на вопрос про аналитику.
 *
 * Пишутся оба ключа: `granted`/`denied` — сам ответ, `vedal.cookies.v1` —
 * отметка «плашку видел». Второй нужен на случай, если счётчик потом
 * снимут: плашка не должна вернуться к тому, кто уже всё сказал.
 */
export function answer(allowAnalytics: boolean): void {
  save([
    [NOTICE_KEY, new Date().toISOString()],
    [ANALYTICS_KEY, allowAnalytics ? "granted" : "denied"],
  ]);
}

/**
 * «Понятно» на плашке без выбора — там, где счётчика нет.
 *
 * Ключ про аналитику НЕ пишется, и это главное в этой функции. Записать
 * сюда `granted` значило бы включить счётчик тому, кого о счётчике не
 * спрашивали, — согласие задним числом. Записать `denied` — отказ задним
 * числом, столь же выдуманный. Поэтому появится счётчик — появится
 * и вопрос, а этот человек увидит плашку ещё раз.
 */
export function acknowledge(): void {
  save([[NOTICE_KEY, new Date().toISOString()]]);
}
