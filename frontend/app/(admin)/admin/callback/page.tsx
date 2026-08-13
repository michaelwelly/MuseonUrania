"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { completeLogin } from "@/lib/auth";
import { message } from "../ui";

// Возврат из Keycloak. Здесь код авторизации меняется на токены и браузер
// уходит туда, откуда начинали.
//
// Страница вынесена из-под проверки входа в оболочке: токена на этот момент
// ещё нет, и оболочка отправила бы человека на вход по кругу.
export default function CallbackPage() {
  // useSearchParams требует границы Suspense: без неё вся страница уходит
  // в динамический рендер, а она статическая — данные приезжают из адреса
  // в браузере.
  return (
    <Suspense fallback={<Screen title="Заканчиваем вход" />}>
      <Callback />
    </Suspense>
  );
}

function Callback() {
  const params = useSearchParams();
  const denial = params.get("error");
  const code = params.get("code");

  // Разбор адреса — это чтение, а не побочный эффект, поэтому начальное
  // состояние считается прямо здесь. setState внутри эффекта на первом же
  // рендере вызывает лишний каскад и запрещён правилами хуков.
  const [error, setError] = useState<string | null>(() => {
    if (denial) return params.get("error_description") ?? denial;
    if (!code) return "Keycloak вернул ответ без кода авторизации.";
    return null;
  });

  useEffect(() => {
    if (!code || denial) return;

    completeLogin(code)
      .then((returnTo) => {
        // replace, а не assign: «назад» не должно возвращать на страницу
        // с уже использованным кодом.
        window.location.replace(returnTo);
      })
      .catch((e: unknown) => setError(message(e)));
  }, [code, denial]);

  return (
    <Screen title={error ? "Войти не удалось" : "Заканчиваем вход"}>
      {error && <p>{error}</p>}
      {error && (
        <a className="btn btn--primary" href="/admin/">
          Попробовать снова
        </a>
      )}
    </Screen>
  );
}

function Screen({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="login">
      <div className="login__card">
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  );
}
