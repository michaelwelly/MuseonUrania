"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AnimatedLogo from "@/components/AnimatedLogo";
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
// Разделы сгруппированы и подписаны, а не разделены безымянной чертой.
// Двенадцать пунктов подряд читаются как свалка, в которой ищут глазами
// каждый раз заново; три названные группы совпадают с тем, чем человек занят:
// редактор правит содержимое, менеджер ведёт клиентов, журнал смотрят,
// когда что-то расследуют.
const NAV = [
  {
    title: "Содержимое сайта",
    items: [
      { href: "/admin/", label: "Сводка" },
      { href: "/admin/products/", label: "Продукция" },
      { href: "/admin/categories/", label: "Категории" },
      { href: "/admin/news/", label: "Новости" },
      { href: "/admin/documents/", label: "Документы" },
    ],
  },
  {
    title: "Работа с клиентами",
    items: [
      // Разговоры первыми: это единственный раздел, где человек ждёт ответа
      // прямо сейчас. Остальное подождёт до конца дня, а он — нет.
      { href: "/admin/chats/", label: "Разговоры" },
      { href: "/admin/leads/", label: "Заявки" },
      { href: "/admin/clients/", label: "Клиенты" },
      { href: "/admin/deals/", label: "Сделки" },
      { href: "/admin/quotes/", label: "КП" },
      { href: "/admin/analytics/", label: "Аналитика" },
    ],
  },
  {
    title: "Контроль",
    items: [{ href: "/admin/audit/", label: "Журнал" }],
  },
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
        {/* Кнопка первой, объяснение после. Человек, открывший рабочее место
            в девять утра, пришёл войти, а не прочитать про устройство входа.
            «Войти через Keycloak» — имя внутренней системы: сотруднику оно
            не говорит ничего, а на экране входа лишнее слово стоит дороже
            всего остального. */}
        <button
          className="btn btn--primary login__big"
          onClick={() => void login(pathname ?? "/admin/")}
        >
          Войти по рабочей учётной записи
        </button>
        <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
          Откроется страница входа компании. После неё вернётесь сюда же — на ту страницу,
          с которой ушли.
        </p>
        {/* Техническая часть остаётся, но ниже и мельче: она нужна тому, кто
            настраивает вход, а не тому, кто им пользуется. */}
        <p style={{ fontSize: 12.5 }}>
          Пароль и второй фактор портал не хранит и не проверяет: они живут в системе входа
          компании. Портал проверяет уже выданный токен и разбирает роли из него.
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

  // Рабочее место, а не страница.
  //
  // Раньше админка была устроена как обычный сайт: шапка, под ней всё подряд,
  // страница растёт вниз без предела. Из-за этого на длинном списке сделок
  // уезжали и разделы, и кто вошёл, а чтобы перейти в другой раздел, надо было
  // сначала прокрутить экран обратно наверх.
  //
  // Теперь высота фиксирована по окну, а прокручиваются области внутри.
  // Так устроены почта, мессенджер и любая CRM, и не из подражания: инструмент,
  // которым работают весь день, обязан держать навигацию на месте.
  return (
    <div className="admin-app">
      <aside className="admin-side">
        <Link className="admin-brand" href="/admin/" aria-label="VEDAL Portal, сводка">
          <AnimatedLogo height={38} />
        </Link>

        <div className="admin-circuit">закрытый контур</div>

        <nav className="admin-side__nav" aria-label="Разделы админки">
          {NAV.map((group) => (
            <div key={group.title} className="admin-side__group">
              <div className="admin-side__title">{group.title}</div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current(pathname, item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="admin-work">
        <header className="admin-top">
          <Who who={state.who} />
        </header>

        <main className="admin-main">{children}</main>
      </div>
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
  const roles = who.roles.length > 0 ? who.roles.join(" · ") : "без ролей";

  return (
    <button className="admin-who" onClick={() => logout()} title="Выйти из админки">
      {/* Две строки, выключка вправо — там же, где на сайте телефон
          и часы работы. */}
      <span className="admin-who__text">
        <span className="admin-who__name">{who.actor}</span>
        {/* Роли и «Выйти» лежат друг на друге и меняются местами при
            наведении. Так карточка остаётся карточкой, а не превращается
            в кнопку с подписью, но нажатие перестаёт быть сюрпризом:
            то, что случится, написано до того, как нажали. */}
        <span className="admin-who__swap">
          <span className="admin-who__meta">{roles}</span>
          <span className="admin-who__exit">Выйти</span>
        </span>
      </span>
      <span className="admin-who__mark" aria-hidden="true">
        {initials(who.actor)}
      </span>
    </button>
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
