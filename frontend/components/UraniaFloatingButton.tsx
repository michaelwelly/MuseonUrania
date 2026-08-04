"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { urania, URANIA_AVATAR } from "@/content/site";
import styles from "./UraniaFloatingButton.module.css";

// docs/frontend/sitemap.md → Urania Placement: кнопка появляется после скролла.
// Показываем её, когда карточка ассистента ушла из вида — это работает при любой
// длине страницы, в отличие от порога в пикселях.
// Панель чата ещё не построена, поэтому клик возвращает к карточке.
// Заменить на открытие чата, когда появится бэкенд.
export default function UraniaFloatingButton({ targetId }: { targetId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const card = document.getElementById(targetId);
    if (!card) return;
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(!entry.isIntersecting),
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [targetId]);

  if (!visible) return null;

  return (
    <button
      type="button"
      className={styles.floating}
      data-analytics="urania_open"
      aria-label={`Открыть ассистента ${urania.name}`}
      onClick={() =>
        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" })
      }
    >
      <Image src={URANIA_AVATAR} alt="" width={68} height={68} />
    </button>
  );
}
