"use client";

import { useState } from "react";
import { subscribe } from "@/content/news";
import { site } from "@/content/site";
import { ui } from "@/content/ui";
import { contentText } from "@/lib/content-i18n";
import type { Lang } from "@/lib/i18n";
import styles from "./page.module.css";

// Рассылки ещё нет. После валидного адреса честно говорим, что подписка не
// подключена, и даём рабочую почту. Ложное «вы подписаны» показывать нельзя.
//
// Заголовок, подпись поля и кнопка — интерфейс, они те же, что у формы
// подписки в подвале: две формы одного действия, и расходиться подписям
// незачем. Поясняющий абзац остаётся содержательным — он обещает, что
// именно придёт и чего не придёт, а это обещание компании.
export default function NewsSubscribe({ lang }: { lang: Lang }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "invalid" | "pending">("idle");
  const strings = ui(lang);
  const c = contentText(lang);

  return (
    <form
      className={styles.subscribe}
      data-reveal="1"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setState(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "pending" : "invalid");
      }}
    >
      <h2 className={styles.subscribeTitle}>{strings.news.subscribeTitle}</h2>
      <p className={styles.subscribeText} lang={c.mark(subscribe.text)}>
        {c.t(subscribe.text)}
      </p>

      <div className={styles.subscribeRow}>
        <input
          type="email"
          className={`${styles.input} ${state === "invalid" ? styles.invalid : ""}`}
          placeholder={strings.footer.subscribePlaceholder}
          aria-label={strings.footer.subscribePlaceholder}
          aria-invalid={state === "invalid"}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state !== "idle") setState("idle");
          }}
        />
        <button type="submit" className={styles.submit}>
          {strings.footer.subscribeSubmit}
        </button>
      </div>

      {state === "invalid" && <p className={styles.result}>{strings.news.subscribeInvalid}</p>}
      {state === "pending" && (
        // Почта подставляется в строку словаря, а не приклеивается к ней
        // в разметке: в китайском адрес стоит в середине фразы.
        <p className={styles.result} role="status">
          {strings.news.subscribePending(site.email)}
        </p>
      )}
    </form>
  );
}
