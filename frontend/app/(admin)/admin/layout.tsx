"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AnimatedLogo from "@/components/AnimatedLogo";
import { accessToken, authConfigured, login, logout, onSessionLost } from "@/lib/auth";
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
//
// ───────────────────────────────────────────────────────────────────────────
// Почему разделы наверху, а не сбоку
//
// Тёмная колонка слева честно показывала периметр, но делала админку вторым
// продуктом: сайт — белая липкая шапка с логотипом слева, навигацией по центру
// и телефоном справа, админка — тёмная панель на 232 пикселя. Один и тот же
// человек ходит и туда, и туда, и каждый переход стоил ему перестройки.
//
// Теперь раскладка совпадает с сайтом до размеров: полоса 78 пикселей, поля
// по 48, знак слева, разделы 15 пикселей с зелёной чертой под текущим, справа
// — две строки на месте телефона и зелёная кнопка на месте «Связаться».
//
// Двенадцать пунктов в одну строку не помещаются и читаются как свалка,
// поэтому уровня два: в шапке четыре раздела, под ней — вкладки текущего.
// Это та же полоса вкладок, что на карточке изделия (`products/[slug]`),
// а не изобретённый для админки элемент.

type Item = { href: string; label: string };
type Section = { label: string; href: string; items: readonly Item[] };

// `href` раздела — куда ведёт клик по нему в шапке. У разделов со вкладками
// это первая вкладка: раздел без своей страницы не должен вести в никуда.
const NAV: readonly Section[] = [
  { label: "Сводка", href: "/admin/", items: [] },
  {
    label: "Содержимое сайта",
    href: "/admin/products/",
    items: [
      { href: "/admin/products/", label: "Продукция" },
      { href: "/admin/categories/", label: "Категории" },
      { href: "/admin/news/", label: "Новости" },
      { href: "/admin/documents/", label: "Документы" },
    ],
  },
  {
    label: "Работа с клиентами",
    href: "/admin/chats/",
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
  { label: "Журнал", href: "/admin/audit/", items: [] },
] as const;

type State =
  | { kind: "checking" }
  | { kind: "anonymous" }
  | { kind: "refused"; reason: string }
  | { kind: "ready"; who: Session };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<State>({ kind: "checking" });
  const [menu, setMenu] = useState(false);
  const nav = useRef<HTMLDivElement>(null);

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

  // Выход в соседней вкладке.
  //
  // Токены лежат в localStorage — он общий на весь браузер. Без этой подписки
  // вторая вкладка продолжала бы показывать рабочий интерфейс после выхода
  // в первой: кнопки на месте, а запросы отбиваются, и понять почему нельзя.
  useEffect(() => {
    if (isCallback) return;
    return onSessionLost(() => setState({ kind: "anonymous" }));
  }, [isCallback]);

  // Высота липкой навигации — числом в CSS-переменную.
  //
  // Под неё подстраивается липкая шапка таблиц: без отступа заголовки колонок
  // уезжают под разделы, с отступом «на глаз» — повисают в воздухе, и строки
  // проезжают над ними. Числом в стилях это не задать честно: полоса вкладок
  // есть не на каждом разделе, а сама шапка меняет высоту на трёх порогах и
  // переносится на две строки. Наблюдатель меряет то, что получилось, вместо
  // шести догадок, которые расходятся с вёрсткой по одной.
  useEffect(() => {
    const node = nav.current;
    if (!node) return;

    const measure = () =>
      document.documentElement.style.setProperty("--chrome", `${node.offsetHeight}px`);

    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(node);
    return () => watch.disconnect();
    // Пересобирается при смене состояния входа: до входа узла нет вовсе,
    // и наблюдать нечего.
  }, [state.kind]);

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
        <p className="muted" style={{ fontSize: "var(--t-small)", marginBottom: "var(--s5)" }}>
          Откроется страница входа компании. После неё вернётесь сюда же — на ту страницу,
          с которой ушли.
        </p>
        {/* Техническая часть остаётся, но ниже и мельче: она нужна тому, кто
            настраивает вход, а не тому, кто им пользуется. */}
        <p style={{ fontSize: "var(--t-small)" }}>
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

  const active = section(pathname);
  // Последняя крошка: вкладка, на которой человек стоит. У раздела без
  // вкладок это он сам — «Админка / Сводка» вместо «Админка».
  const here =
    active && active.items.length > 0
      ? active.items.find((item) => within(pathname ?? "", item.href))
      : active;

  return (
    <div className="admin-shell">
      {/* Обе полосы в одной липкой обёртке, а не по отдельности: высота шапки
          меняется на трёх брейкпоинтах, и «top: 78px» у вкладок разъехался бы
          ровно там, где полоса переносится на две строки. */}
      <div className="admin-nav" ref={nav}>
        <div className="admin-bar">
          <Link className="admin-brand" href="/admin/" aria-label="VEDAL Portal, сводка">
            {/* 42 — та же высота знака, что в шапке сайта. */}
            <AnimatedLogo height={42} />
          </Link>

          {/* Метка контура. Не украшение: человек должен видеть, что он внутри
              закрытого контура, где на экране бывают персональные данные. */}
          <span className="admin-circuit">закрытый контур</span>

          <nav className="admin-sections" aria-label="Разделы админки">
            {NAV.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className={`admin-section${s === active ? " admin-section--on" : ""}`}
                aria-current={s === active ? "page" : undefined}
              >
                {s.label}
              </Link>
            ))}
          </nav>

          <div className="admin-tools">
            <Who who={state.who} />

            {/* Выход — обведённой кнопкой на месте кнопки-телефона в шапке
                сайта. Отдельной кнопкой, а не действием карточки: выход
                не должен случаться от промаха по имени. */}
            <button
              type="button"
              className="admin-exit"
              onClick={() => logout()}
              aria-label="Выйти из админки"
              title="Выйти из админки"
            >
              <ExitIcon />
            </button>

            {/* На месте «Связаться» — переход на сайт. Это то действие, ради
                которого редактор чаще всего уходит из админки: посмотреть,
                как опубликованное выглядит снаружи. В новой вкладке, чтобы
                несохранённая форма не пропала. */}
            <a
              className="admin-cta"
              href="/"
              target="_blank"
              rel="noreferrer"
              title="Публичный сайт в новой вкладке"
            >
              Открыть сайт
              <Arrow />
            </a>

            <button
              type="button"
              className="admin-burger"
              aria-label="Разделы"
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
            >
              <span className="admin-burger__lines" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
          </div>
        </div>

        {/* Вкладки раздела — та же полоса, что на карточке изделия. Разделу
            из одного пункта полоса не нужна: она повторяла бы заголовок. */}
        {active && active.items.length > 1 && (
          <nav className="admin-tabs" aria-label={active.label}>
            {active.items.map((item) => {
              const on = within(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`admin-tab${on ? " admin-tab--on" : ""}`}
                  aria-current={on ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {/* На телефоне два уровня превращаются в один список: разделы
            подписаны, вкладки под ними. Искать вкладку, сначала попав
            в раздел, на маленьком экране дороже, чем пролистать двенадцать
            строк один раз. */}
        {menu && (
          <nav className="admin-menu" aria-label="Разделы админки">
            {NAV.map((s) => (
              <div key={s.label} className="admin-menu__group">
                <div className="admin-menu__title">{s.label}</div>
                {/* Меню закрывается выбором, а не только повторным нажатием
                    на бургер: иначе оно остаётся поверх страницы, которую
                    человек только что открыл. */}
                {(s.items.length === 0 ? [{ href: s.href, label: s.label }] : s.items).map(
                  (item) => {
                    const on = within(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={on ? "admin-menu__on" : undefined}
                        aria-current={on ? "page" : undefined}
                        onClick={() => setMenu(false)}
                      >
                        {item.label}
                      </Link>
                    );
                  },
                )}
              </div>
            ))}
          </nav>
        )}
      </div>

      <main className="admin-main">
        {/* Хлебные крошки — как на внутренней странице сайта: моноширинная
            строка над заголовком, в той же белой полосе. Они же отвечают
            на вопрос, которого не было при колонке слева: раздел теперь
            свёрнут в четыре слова наверху, и «где я» должно читаться
            в самом содержимом, а не только по подсветке вкладки. */}
        <div className="admin-crumbs">
          <Link href="/admin/">Админка</Link>
          {active && active.items.length > 0 && (
            <>
              <span aria-hidden="true"> / </span>
              <Link href={active.href}>{active.label}</Link>
            </>
          )}
          {here && (
            <>
              <span aria-hidden="true"> / </span>
              <span className="admin-crumbs__here">{here.label}</span>
            </>
          )}
        </div>

        {children}
      </main>

      {/* Тонкая полоса вместо футера сайта: ссылки сайта здесь не нужны,
          а напоминание про периметр — нужно, и оно должно быть на экране
          и внизу длинного списка, а не только в шапке. */}
      <footer className="admin-foot">
        <span className="admin-foot__circuit">закрытый контур</span>
        <span>Персональные данные не выносятся за периметр — ни снимком экрана, ни письмом.</span>
        <a className="admin-foot__link" href="/" target="_blank" rel="noreferrer">
          Публичный сайт →
        </a>
      </footer>
    </div>
  );
}

/**
 * Кто вошёл — в правом верхнем углу, на месте телефона в шапке сайта
 * и в той же форме: две строки с выключкой вправо.
 *
 * Роли показываются те, что разобрал портал, а не те, что лежат в токене:
 * расходятся они ровно тогда, когда что-то настроено не так, и увидеть это
 * надо здесь, а не в отказе на первом же действии.
 *
 * Роли набраны моноширинным: `portal-admin` — идентификатор, а не слово,
 * и читается он как идентификатор.
 */
function Who({ who }: { who: Session }) {
  return (
    <div className="admin-who">
      <span className="admin-who__name">{who.actor}</span>
      <span className="admin-who__meta">
        {who.roles.length > 0 ? who.roles.join(" · ") : "без ролей"}
      </span>
    </div>
  );
}

/** Стрелка кнопки — та же, что в шапке сайта. */
function Arrow() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8M17 8l4 4-4 4M21 12H10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="square"
      />
    </svg>
  );
}

/**
 * Раздел текущей страницы.
 *
 * Сводка подсвечивается только на самой сводке: иначе она горит на каждой
 * странице, потому что её адрес — префикс всех остальных. Поэтому она стоит
 * первой и сверяется на точное совпадение, а не на префикс.
 */
function section(pathname: string | null): Section | undefined {
  if (!pathname) return undefined;
  return NAV.find(
    (s) => within(pathname, s.href) || s.items.some((item) => within(pathname, item.href)),
  );
}

/**
 * Страница внутри ветки адреса.
 *
 * Сравнение по префиксу без завершающего слеша: у вкладки адрес
 * `/admin/clients/`, а открытая карточка — `/admin/clients/42`, и это
 * одна и та же вкладка. Сводка — исключение: её адрес префикс всему.
 */
function within(pathname: string, href: string): boolean {
  const path = pathname.replace(/\/+$/, "");
  const base = href.replace(/\/+$/, "");
  if (base === "/admin") return path === "/admin";
  return path === base || path.startsWith(`${base}/`);
}
