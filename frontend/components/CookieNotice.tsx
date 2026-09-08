"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { cookies } from "@/content/legal";
import { metrikaId } from "@/lib/analytics";
import {
  acknowledge,
  answer,
  asksThirdParty,
  readConsent,
  readServerConsent,
  subscribe,
} from "@/lib/consent";
import styles from "./CookieNotice.module.css";

/**
 * Плашка про cookie. §14.5 плана, issues #53 и #74.
 *
 * Спрашивает, пока на площадке есть сторонний ресурс Яндекса: счётчик
 * Метрики, карта на контактах или оба. До ответа `Analytics` не поднимает
 * счётчик, а `VedalMapEmbed` не создаёт кадр карты. Нет ни того, ни другого —
 * плашка сообщает, а не спрашивает. Ответ хранится в localStorage; почему
 * именно там и как устроено хранилище — в `lib/consent.ts`.
 *
 * ————— почему useSyncExternalStore, а не useEffect —————
 *
 * localStorage — внешнее хранилище, и на сервере его нет. Страницы сайта
 * отдаются статикой: разметка одна на всех, и плашка, попавшая в неё, мигнула
 * бы у тех, кто уже ответил, — сервер не знает, кто это.
 *
 * Отсюда серверный снимок «ответ неизвестен», и при таком значении
 * не рисуется ничего. React берёт его на гидратации, а сразу после неё
 * перечитывает настоящий — расхождения разметки не возникает, и плашка
 * появляется только у тех, кто ещё не отвечал.
 */
export default function CookieNotice() {
  const consent = useSyncExternalStore(subscribe, readConsent, readServerConsent);

  if (consent !== "unanswered") return null;

  // Вопрос задаётся только там, где есть что разрешать: счётчик Метрики,
  // карта на контактах или оба сразу. Нет ничего — выбор «принять или
  // только необходимые» бутафория: отклонять нечего, а вид согласия при
  // отсутствии передачи данных обесценивает согласие настоящее.
  //
  // Текст называет ровно то, что на площадке есть. Общая формулировка
  // «сторонние сервисы» дешевле в поддержке и хуже по сути: человек должен
  // видеть, кому и в связи с чем уходят данные, а не догадываться.
  const copy = metrikaId
    ? cookies.withAnalytics
    : asksThirdParty
      ? cookies.withMap
      : cookies.necessaryOnly;

  return (
    <aside className={styles.notice} role="complementary" aria-label="Использование cookie">
      <p className={styles.text}>
        {copy.text}{" "}
        <Link className={styles.link} href={cookies.href}>
          {cookies.linkLabel}
        </Link>
      </p>
      <div className={styles.buttons}>
        {copy.decline && (
          // «Только необходимые» стоит первой и оформлена ровно так же
          // заметно, как «Принять». Спрятанный отказ — это отказ, которого
          // нет: согласие, полученное тем, что второй кнопки не видно,
          // согласием не является.
          <button type="button" className={styles.decline} onClick={() => answer(false)}>
            {copy.decline}
          </button>
        )}
        <button
          type="button"
          className={styles.accept}
          onClick={() => (asksThirdParty ? answer(true) : acknowledge())}
        >
          {copy.accept}
        </button>
      </div>
    </aside>
  );
}
