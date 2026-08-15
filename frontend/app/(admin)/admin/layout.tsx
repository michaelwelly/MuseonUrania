"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AnimatedLogo from "@/components/AnimatedLogo";
import { accessToken, authConfigured, login, logout } from "@/lib/auth";
import { adminConfigured, session, type Session } from "@/lib/admin";
import { site } from "@/content/site";
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
    <div className="admin-app">
      {/* Один ряд: знак, разделы, кто вошёл. Всё, что можно было убрать
          отсюда, убрано — «На сайт» и «Выйти» переехали в футер, подпись
          «админка» снята за ненадобностью: человек и так знает, куда
          вошёл, а место она занимала как полтора раздела. */}
      <header className="admin-top">
        <Link className="admin-brand" href="/admin/" aria-label="VEDAL Portal, сводка">
          {/* 42 — та же высота, что у знака в шапке сайта. */}
          <AnimatedLogo height={42} />
        </Link>

        <nav className="admin-top__nav" aria-label="Разделы админки">
          {NAV.map((item, i) =>
            "group" in item ? (
              <span key={`sep-${i}`} className="admin-top__sep" aria-hidden="true" />
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
        </nav>

        <Who who={state.who} />
      </header>

      <main className="admin-main">{children}</main>

      <footer className="admin-foot">
        <div className="admin-foot__left">
          <span className="admin-brand__plate">
            <AnimatedLogo height={26} />
          </span>
          <span>
            © {new Date().getFullYear()} {site.legalName}
          </span>
        </div>

        <div className="admin-foot__right">
          <span className="admin-circuit">закрытый контур</span>
          {/* Переход между группами маршрутов перезагружает страницу целиком —
              у сайта и админки разные корневые layout'ы. Next делает это сам,
              Link здесь ради предзагрузки и того, чтобы правило проверки
              ссылок не спотыкалось. */}
          <Link href="/">На сайт</Link>
          {/* Выход убран из шапки, но не из продукта: выйти надо чем-то,
              и место рядом с «На сайт» ему подходит — оба увода отсюда. */}
          <button className="admin-foot__exit" onClick={() => logout()}>
            Выйти
          </button>
        </div>
      </footer>
    </div>
  );
}

/**
 * Кто вошёл — в правом верхнем углу.
 *
 * Значок собирается из первых букв самого имени, а не берётся картинкой:
 * фотографий сотрудников у портала нет и не будет — он знает про человека
 * ровно то, что отдал Keycloak.
 *
 * Роли показываются те, что разобрал портал, а не те, что лежат в токене:
 * расходятся они ровно тогда, когда что-то настроено не так, и увидеть это
 * надо здесь, а не в отказе на первом же действии.
 */
function Who({ who }: { who: Session }) {
  return (
    <div className="admin-who">
      {/* Две строки, выключка вправо — там же, где на сайте телефон
          и часы работы. */}
      <span className="admin-who__text">
        <span className="admin-who__name">{who.actor}</span>
        <span className="admin-who__meta">
          {who.roles.length > 0 ? who.roles.join(" · ") : "без ролей"}
        </span>
      </span>
      <span className="admin-who__mark" aria-hidden="true">
        {initials(who.actor)}
      </span>
    </div>
  );
}


/** Две первые буквы имени: «Анна Фёдорова» → «АФ», «editor» → «ED». */
function initials(actor: string): string {
  const parts = actor.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "—";
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
  return letters.toUpperCase();
}

// Сводка подсвечивается только на самой сводке: иначе она горит на каждой
// странице, потому что её адрес — префикс всех остальных.
function current(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return href === "/admin/" ? pathname === "/admin/" : pathname.startsWith(href);
}
