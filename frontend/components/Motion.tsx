"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { mountMotion } from "@/lib/motion";

// Перемонтируется на смену маршрута: новая страница приносит новые цели
// [data-reveal] и [data-words]. Рисует полосу прогресса — её заполняет скрипт.
export default function Motion() {
  const pathname = usePathname();
  useEffect(() => mountMotion(), [pathname]);

  return (
    <div className="v-scrollbar" aria-hidden="true">
      <div className="v-scrollbar-fill" data-scroll-fill />
    </div>
  );
}
