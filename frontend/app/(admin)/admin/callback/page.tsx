"use client";

import { useEffect, useState } from "react";
import { completeLogin } from "@/lib/auth";
import { message } from "../ui";

// Возврат из Keycloak. Здесь код авторизации меняется на токены и браузер
// уходит туда, откуда начинали.
//
// Страница вынесена из-под проверки входа в оболочке: токена на этот момент
// ещё нет, и оболочка отправила бы человека на вход по кругу.
export default function Callback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const denial = params.get("error");
    if (denial) {
      setError(params.get("error_description") ?? denial);
      return;
    }

    const code = params.get("code");
    if (!code) {
      setError("Keycloak вернул ответ без кода авторизации.");
      return;
    }

    completeLogin(code)
      .then((returnTo) => {
        // replace, а не assign: «назад» не должно возвращать на страницу
        // с уже использованным кодом.
        window.location.replace(returnTo);
      })
      .catch((e: unknown) => setError(message(e)));
  }, []);

  return (
    <div className="login">
      <div className="login__card">
        <h1>{error ? "Войти не удалось" : "Заканчиваем вход"}</h1>
        {error && <p>{error}</p>}
        {error && (
          <a className="btn btn--primary" href="/admin/">
            Попробовать снова
          </a>
        )}
      </div>
    </div>
  );
}
