"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { completeLogin } from "@/lib/auth";
import { message } from "../ui";
import Entry from "../Entry";

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
    <Suspense fallback={<Entry state="обмен кода" title="Заканчиваем вход" />}>
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
    <Entry
      state={error ? "обмен кода не удался" : "обмен кода"}
      title={error ? "Войти не удалось" : "Заканчиваем вход"}
    >
      {error ? (
        <>
          <p>{error}</p>
          <p>
            Код авторизации одноразовый и живёт минуту: чаще всего он просто устарел, пока
            страница висела открытой. Начните вход заново.
          </p>
          <a className="btn btn--primary login__big" href="/admin/">
            Начать заново
          </a>
        </>
      ) : (
        <p>Меняем код авторизации на токен и возвращаем вас туда, откуда начинали.</p>
      )}
    </Entry>
  );
}

