"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { accessToken, authConfigured, login, logout } from "@/lib/auth";
import { adminConfigured, session, type Session } from "@/lib/admin";
import { message } from "./ui";
import Entry from "./Entry";

// Оболочка админки: вход и навигация.
//
// Интерфейс, спрятавший кнопку, ничего не защищает — запрос всё равно можно
// послать руками, и права проверяет портал. Здесь решается другая задача:
// показать, вошёл ли человек и принял ли портал его токен. Это разные вещи,
// и различить их важно: подписанный токен без роли портала проходит проверку
// подписи и получает 403, а «данных нет» выглядит так же, как «доступа нет».

// Два раздела с разделителем: содержимое сайта и работа с клиентами.
// Плоский список из одиннадцати пунктов читается как свалка, а разделы
// совпадают с тем, чем человек занят: редактор правит каталог, менеджер
// ведёт сделки.
const NAV = [
  { href: "/admin/", label: "Сводка" },
  { href: "/admin/products/", label: "Продукция" },
  { href: "/admin/categories/", label: "Категории" },
  { href: "/admin/news/", label: "Новости" },
  { href: "/admin/documents/", label: "Документы" },
  { group: "CRM" },
  { href: "/admin/leads/", label: "Заявки" },
  { href: "/admin/clients/", label: "Клиенты" },
  { href: "/admin/deals/", label: "Сделки" },
  { href: "/admin/quotes/", label: "КП" },
  { href: "/admin/analytics/", label: "Аналитика" },
  { group: "" },
  { href: "/admin/audit/", label: "Журнал" },
] as const;

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
      <Entry state="не настроено" title="Админке некуда ходить">
        <p>
          Не заданы переменные сборки: {!adminConfigured && <code>NEXT_PUBLIC_API_URL</code>}
          {!adminConfigured && !authConfigured && ", "}
          {!authConfigured && <code>NEXT_PUBLIC_OIDC_ISSUER</code>}.
        </p>
        <p>
          Это не поломка входа: без адреса портала запрашивать нечего, без адреса realm&apos;а
          негде получить токен. Задаются в окружении — в контейнере их ставит{" "}
          <code>compose.yaml</code>, на машине — <code>.env.local</code>.
        </p>
      </Entry>
    );
  }

  if (state.kind === "checking") {
    return (
      <Entry state="проверяем токен" title="Секунду">
        <p>Смотрим, есть ли действующий токен и принимает ли его портал.</p>
      </Entry>
    );
  }

  if (state.kind === "anonymous") {
    return (
      <Entry state="вход не выполнен" title="Вход для сотрудников">
        <p>
          Пароли и второй фактор живут в Keycloak. Портал их не хранит и не проверяет — он
          проверяет уже выданный токен и разбирает роли из него.
        </p>
        <button
          className="btn btn--primary login__big"
          onClick={() => void login(pathname ?? "/admin/")}
        >
          Войти через Keycloak
        </button>
        <p className="muted" style={{ fontSize: 13 }}>
          Вернётесь сюда же, на страницу, с которой ушли.
        </p>
      </Entry>
    );
  }

  // Токен есть, а портал его не принял. Это отдельный случай, а не «войдите
  // ещё раз»: повторный вход выдаст тот же токен и получит тот же отказ.
  if (state.kind === "refused") {
    return (
      <Entry state="токен не принят" title="Портал отказал">
        <p>{state.reason}</p>
        <p>
          Вход в Keycloak прошёл — иначе токена не было бы вовсе. Отказал уже портал, и чаще
          всего потому, что у учётной записи нет роли <code>portal-admin</code> или{" "}
          <code>portal-editor</code> в realm&apos;е. Роль выдаёт тот, кто держит Keycloak;
          повторный вход ничего не изменит, токен будет тот же.
        </p>
        <div className="row">
          <button className="btn" onClick={() => logout()}>
            Выйти и войти другой учётной записью
          </button>
        </div>
      </Entry>
    );
  }

  return (
    <div className="admin-shell">
      <nav className="admin-nav">
        <div className="admin-nav__mark">VEDAL</div>
        <div className="admin-nav__sub">portal · админка</div>
        {NAV.map((item, i) =>
          "group" in item ? (
            <div key={`group-${i}`} className="admin-nav__group">
              {item.group}
            </div>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current(pathname, item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ),
        )}
        <div className="admin-nav__foot">
          <span className="admin-circuit">закрытый контур</span>

          <div className="admin-who">
            <span className="admin-who__name">{state.who.actor}</span>
            {/* Роли показываются те, что разобрал портал, а не те, что лежат
                в токене: расходятся они ровно тогда, когда что-то настроено
                не так, и увидеть это надо здесь, а не в отказе на действии. */}
            <span className="admin-who__meta">
              {state.who.roles.length > 0 ? state.who.roles.join(" · ") : "без ролей"}
            </span>
            <span className="admin-who__meta">вход: {state.who.authentication}</span>
          </div>

          <div className="row">
            {/* Переход между группами маршрутов перезагружает страницу
                целиком — у сайта и админки разные корневые layout'ы. Next
                делает это сам, Link здесь нужен ради предзагрузки и того,
                чтобы правило проверки ссылок не спотыкалось. */}
            <Link className="btn btn--small" href="/">
              На сайт
            </Link>
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
