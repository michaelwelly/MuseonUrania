"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { urania } from "@/content/urania";
import UraniaChat from "./UraniaChat";
import styles from "./UraniaWidget.module.css";

// Плавающий чат в правом нижнем углу. Подключён в layout, поэтому доступен
// на всех страницах.
//
// Ссылки «Спросить Уранию» с других экранов ведут на #urania — виджет
// открывается по хешу, чтобы не тащить общее состояние через контекст.
export default function UraniaWidget() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    if (window.location.hash === "#urania") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash === "#urania") setOpen(true);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (open) {
    return (
      <div className={styles.panel} role="dialog" aria-label={`Чат с ассистентом ${urania.name}`}>
        <UraniaChat onClose={close} />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={styles.launcher}
      onClick={() => setOpen(true)}
      aria-label={`Открыть чат с ассистентом ${urania.name}`}
      data-analytics="urania_open"
    >
      <span className={styles.launcherAvatar}>
        <Image src={urania.avatar} alt="" fill sizes="48px" />
        <span className={styles.launcherDot} aria-hidden="true" />
      </span>
      <span className={styles.launcherLabel}>Задать вопрос</span>
    </button>
  );
}
