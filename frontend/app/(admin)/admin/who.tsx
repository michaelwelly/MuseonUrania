"use client";

import { createContext, useContext } from "react";
import type { Session } from "@/lib/admin";

// Кто вошёл — на любой странице, без второго запроса.
//
// Оболочка спрашивает портал один раз: без этого «мои заявки», «мои сделки»
// и подстановка себя в поле ответственного просили бы `/session` на каждой
// странице, где встречаются, — а страница сводки встречает их трижды.
//
// Контекст не может быть пустым: провайдер стоит внутри той ветки оболочки,
// которая рисуется только после того, как портал принял токен. Отдельного
// «а вдруг ещё не вошли» здесь не бывает, и проверять его на каждом вызове
// значило бы обрабатывать состояние, которого нет.

const Ctx = createContext<Session | null>(null);

export function WhoHost({ who, children }: { who: Session; children: React.ReactNode }) {
  return <Ctx.Provider value={who}>{children}</Ctx.Provider>;
}

export function useWho(): Session {
  const who = useContext(Ctx);
  if (!who) {
    throw new Error(
      "useWho вызван вне оболочки админки. Такое возможно только если компонент " +
        "вынесли из-под AdminLayout — там, где входа ещё нет, нет и сессии.",
    );
  }
  return who;
}
