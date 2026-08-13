"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { accessToken, authConfigured, login, logout } from "@/lib/auth";
import { adminConfigured, session, type Session } from "@/lib/admin";
import { message } from "./ui";

// Оболочка админки: вход и навигация.
//
// Интерфейс, спрятавший кнопку, ничего не защищает — запрос всё равно можно
// послать руками, и права проверяет портал. Здесь решается другая задача:
// показать, вошёл ли человек и принял ли портал его токен. Это разные вещи,
// и различить их важно: подписанный токен без роли портала проходит проверку
// подписи и получает 403, а «данных нет» выглядит так же, как «доступа нет».

const NAV = [
  { href: "/admin/", label: "Сводка" },
  { href: "/admin/products/", label: "Продукция" },
  { href: "/admin/categories/", label: "Категории" },
  { href: "/admin/news/", label: "Новости" },
  { href: "/admin/documents/", label: "Документы" },
  { href: "/admin/leads/", label: "Заявки" },
  { href: "/admin/audit/", label: "Журнал" },
];

type State =
  | { kind: "checking" }
  | { kind: "anonymous" }
  | { kind: "refused"; reason: string }
  | { kind: "ready"; who: Session };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<State>({ kind: "checking" });

  // Возврат из Keycloak разбирает своя страница: там ещё нет токена,
  // и оболочка отправила бы человека на вход по кругу.
  const isCallback = pathname?.startsWith("/admin/callback");

  useEffect(() => {
    if (isCallback) return;
    let alive = true;

    (async () => {
      const token = await accessToken();
      if (!alive) return;
      if (!token) {
        setState({ kind: "anonymous" });
        return;
      }
      try {
        const who = await session();
        if (alive) setState({ kind: "ready", who });
      } catch (e) {
        // Токен есть, а портал его не принял. Причина в сообщении: не тот
        // realm, не та аудитория, нет роли.
        if (alive) setState({ kind: "refused", reason: message(e) });
      }
    })();

    return () => {
      alive = false;
    };
  }, [isCallback, pathname]);

  if (isCallback) return <>{children}</>;

  if (!adminConfigured || !authConfigured) {
    return (
      <Screen title="Админка не настроена">
        <p>
          Не заданы переменные сборки: {!adminConfigured && <code>NEXT_PUBLIC_API_URL</code>}
          {!adminConfigured && !authConfigured && ", "}
          {!authConfigured && <code>NEXT_PUBLIC_OIDC_ISSUER</code>}. Пока их нет, админке некуда
          ходить и негде получать токен.
        </p>
      </Screen>
    );
  }

  if (state.kind === "checking") {
    return <Screen title="Проверяем вход">{null}</Screen>;
  }

  if (state.kind === "anonymous") {
    return (
      <Screen title="Вход в админку">
        <p>
          Пароли и второй фактор живут в Keycloak. Портал их не хранит и не проверяет — он
          проверяет выданный токен.
        </p>
        <button className="btn btn--primary" onClick={() => void login(pathname ?? "/admin/")}>
          Войти через Keycloak
        </button>
      </Screen>
    );
  }

  if (state.kind === "refused") {
    return (
      <Screen title="Портал не принял токен">
        <p>{state.reason}</p>
        <p>
          Чаще всего это значит, что у учётной записи нет роли <code>portal-admin</code> или{" "}
          <code>portal-editor</code> в realm&apos;е.
        </p>
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn" onClick={() => logout()}>
            Выйти
          </button>
        </div>
      </Screen>
    );
  }

  return (
    <div className="admin-shell">
      <nav className="admin-nav">
        <div className="admin-nav__mark">VEDAL</div>
        <div className="admin-nav__sub">portal · админка</div>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current(pathname, item.href) ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
        <div className="admin-nav__foot">
          <div>
            {state.who.actor}
            <br />
            <span style={{ opacity: 0.7 }}>вход: {state.who.authentication}</span>
          </div>
          <div className="row">
            <a className="btn btn--small" href="/">
              На сайт
            </a>
            <button className="btn btn--small" onClick={() => logout()}>
              Выйти
            </button>
          </div>
        </div>
      </nav>
      <main className="admin-main">{children}</main>
    </div>
  );
}

// Сводка подсвечивается только на самой сводке: иначе она горит на каждой
// странице, потому что её адрес — префикс всех остальных.
function current(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return href === "/admin/" ? pathname === "/admin/" : pathname.startsWith(href);
}

function Screen({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="login">
      <div className="login__card">
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  );
}
