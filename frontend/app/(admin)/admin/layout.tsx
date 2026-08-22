"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { contourName, contourOf, may, mayOpen, type Contour } from "./roles";
import { useEffect, useRef, useState } from "react";
import AnimatedLogo from "@/components/AnimatedLogo";
import { accessToken, authConfigured, login, logout, onSessionLost } from "@/lib/auth";
import { adminConfigured, session, type Session } from "@/lib/admin";
import { message } from "./ui";
import Entry from "./Entry";
import { Avatar } from "./Avatar";
import { Bell } from "./Bell";
import { CountsHost, useCounts, type Counts } from "./counts";
import { Hotkeys } from "./Hotkeys";
import { ArrowIcon, ExitIcon, SearchIcon } from "./icons";
import { useShellKeys } from "./keys";
import { Palette } from "./Palette";
import { ToastHost } from "./Toast";
import { Widget } from "./Widget";
import { WhoHost } from "./who";

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
// по 40, знак слева, разделы 15 пикселей с зелёной чертой под текущим, справа
// — поиск, колокол, кружок с именем и зелёная кнопка на месте «Связаться».
//
// Двенадцать пунктов в одну строку не помещаются и читаются как свалка,
// поэтому уровня два: в шапке четыре раздела, под ней — вкладки текущего.
// Это та же полоса вкладок, что на карточке изделия (`products/[slug]`),
// а не изобретённый для админки элемент.

// `count` — какой счётчик рисовать у вкладки. Ключ, а не число: считает
// оболочка одним заходом, а список разделов — просто описание навигации
// и запросов не делает.
type Item = { href: string; label: string; count?: keyof Counts };
type Section = {
  label: string;
  href: string;
  items: readonly Item[];
  /** Кому раздел виден. Пусто — любому вошедшему. */
  contour?: Contour;
};

// `href` раздела — куда ведёт клик по нему в шапке. У разделов со вкладками
// это первая вкладка: раздел без своей страницы не должен вести в никуда.
// Разделы и контуры. Контур решает, увидит ли раздел этот человек:
// показывать кнопку, которая приведёт к отказу, значит соврать дважды —
// сначала предложив, потом отказав.
const NAV: readonly Section[] = [
  { label: "Сводка", href: "/admin/", items: [] },
  {
    label: "Содержимое сайта",
    href: "/admin/products/",
    contour: "production",
    items: [
      { href: "/admin/products/", label: "Продукция", count: "products" },
      { href: "/admin/categories/", label: "Категории" },
      { href: "/admin/news/", label: "Новости", count: "news" },
      { href: "/admin/documents/", label: "Документы", count: "documents" },
    ],
  },
  {
    label: "Работа с клиентами",
    href: "/admin/chats/",
    contour: "sales",
    items: [
      // Разговоры первыми: это единственный раздел, где человек ждёт ответа
      // прямо сейчас. Остальное подождёт до конца дня, а он — нет.
      // У «Разговоров» счётчик означает не «сколько было», а «сколько ждёт
      // ответа»: это единственная запись портала, у которой на том конце
      // человек, и «всего 340» вместо «ждут 3» здесь означало бы ровно
      // противоположное тому, ради чего счётчик ставят.
      { href: "/admin/chats/", label: "Разговоры", count: "chats" },
      { href: "/admin/leads/", label: "Заявки", count: "leads" },
      { href: "/admin/clients/", label: "Клиенты", count: "clients" },
      { href: "/admin/deals/", label: "Сделки", count: "deals" },
      { href: "/admin/quotes/", label: "КП", count: "quotes" },
      // У аналитики счётчика нет: число «сколько там аналитики» бессмысленно.
      { href: "/admin/analytics/", label: "Аналитика" },
    ],
  },
  {
    label: "Команда",
    // Раздел виден всем, а внутри него — по-разному: свой профиль нужен
    // каждому, справочник сотрудников показывает состав компании
    // и остаётся административным. Поэтому адрес раздела — профиль:
    // ведёт туда, куда пущен любой вошедший.
    href: "/admin/profile/",
    items: [
      { href: "/admin/staff/", label: "Сотрудники" },
      { href: "/admin/profile/", label: "Мой профиль" },
    ],
  },
  { label: "Журнал", href: "/admin/audit/", items: [], contour: "admin" },
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

  // Выход в соседней вкладке.
  //
  // Токены лежат в localStorage — он общий на весь браузер. Без этой подписки
  // вторая вкладка продолжала бы показывать рабочий интерфейс после выхода
  // в первой: кнопки на месте, а запросы отбиваются, и понять почему нельзя.
  useEffect(() => {
    if (isCallback) return;
    return onSessionLost(() => setState({ kind: "anonymous" }));
  }, [isCallback]);

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
          всего потому, что у учётной записи нет ни одной роли портала:{" "}
          <code>portal-admin</code>, <code>portal-sales</code> или{" "}
          <code>portal-production</code> в realm&apos;е. Роль выдаёт тот, кто держит Keycloak;
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

  // Оболочка отделена от разбора входа не ради порядка в файле. Счётчики
  // и очередь разговоров ходят в портал под токеном: заведись они выше, они
  // запрашивались бы и на экране «вход не выполнен», где токена нет, — восемь
  // отказов 401 при каждом открытии двери.
  return (
    <ToastHost>
      <WhoHost who={state.who}>
        <CountsHost>
          <Chrome who={state.who}>{children}</Chrome>
        </CountsHost>
      </WhoHost>
    </ToastHost>
  );
}

/**
 * Рабочая оболочка: две полосы навигации, поверхность, футер и всё
 * всплывающее — поиск, горячие клавиши, уведомления, виджет разговоров.
 *
 * Всплывающее живёт здесь, а не на страницах, по двум причинам. Поиск и
 * виджет должны быть доступны отовсюду — в этом весь их смысл. А открытых
 * окон в один момент должно быть не больше одного: пока открыто хоть одно,
 * одиночные буквы перестают быть командами, и решается это одним флагом
 * в одном месте, а не договорённостью между четырьмя компонентами.
 */
function Chrome({ who, children }: { who: Session; children: React.ReactNode }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const [hotkeys, setHotkeys] = useState(false);
  const [bell, setBell] = useState(false);
  const nav = useRef<HTMLDivElement>(null);
  const { counts } = useCounts();

  useShellKeys({
    onPalette: () => setPalette(true),
    onHotkeys: () => setHotkeys((v) => !v),
    onEscape: () => {
      setPalette(false);
      setHotkeys(false);
      setBell(false);
    },
    busy: palette || hotkeys || bell,
  });

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
  }, []);

  // Разделы этого человека. Отбор один на обе разметки — шапку и меню
  // телефона: два независимых фильтра однажды разойдутся, и разойдутся
  // молча, оставив на телефоне раздел, которого нет на большом экране.
  //
  // Внутри раздела вкладки отбираются тоже: «Команда» видна всем, но
  // «Сотрудники» в ней — административная страница, а «Мой профиль» нужен
  // каждому.
  const мои = NAV.filter((s) => may(who, s.contour ?? "any")).map((s) => ({
    ...s,
    items: s.items.filter((item) => mayOpen(who, item.href)),
  }));

  // Текущий раздел — из ОТОБРАННОГО списка, а не из NAV. Полоса вкладок
  // рисуется из него же, и взятый из NAV раздел показал бы вкладку,
  // куда этот человек не пущен: так «Сотрудники» оставались видны
  // продажам, хотя сам раздел «Команда» им положен.
  const active = section(pathname, мои);
  // Последняя крошка: вкладка, на которой человек стоит. У раздела без
  // вкладок это он сам — «Админка / Сводка» вместо «Админка».
  const here =
    active && active.items.length > 0
      ? active.items.find((item) => within(pathname ?? "", item.href))
      : active;

  // Стоим ровно на пункте навигации, а не глубже. within() совпадает и со
  // списком, и с карточкой внутри него, поэтому здесь нужна точность.
  const наСписке =
    here != null && (pathname ?? "").replace(/[/]+$/, "") === here.href.replace(/[/]+$/, "");

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

          {/* Метка контура ушла из шапки в футер и осталась там одна.
              Причина — замер: место в правом краю понадобилось поиску,
              колоколу и кружку с инициалами, а метка стоит на экране весь
              день и читается ровно один раз — в первый. Внизу длинного
              списка, где до неё доходит взгляд после работы с настоящими
              персональными данными, она полезнее, чем в шапке. */}

          <nav className="admin-sections" aria-label="Разделы админки">
            {мои.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className={`admin-section${s.href === active?.href ? " admin-section--on" : ""}`}
                aria-current={s.href === active?.href ? "page" : undefined}
              >
                {s.label}
              </Link>
            ))}
          </nav>

          <div className="admin-tools">
            {/* Поиск по всему порталу.
                Кнопка, а не поле: набор всё равно идёт в окне поверх страницы,
                и поле в шапке обещало бы, что печатать можно прямо здесь.
                Выглядит полем оно потому, что искать в шапке — привычка,
                и отнимать её незачем; клавиша рядом говорит, что то же самое
                открывается с клавиатуры. */}
            <button
              type="button"
              className="admin-find"
              onClick={() => setPalette(true)}
              aria-label="Поиск по всему порталу"
            >
              <SearchIcon size={17} />
              <span className="admin-find__text">Поиск по всему порталу</span>
              <kbd className="admin-find__key mono">⌘K</kbd>
            </button>

            <Bell open={bell} onToggle={setBell} />

            <Who who={who} />

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
              <ExitIcon size={19} />
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
              <ArrowIcon />
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
              // Счётчика может не быть вовсе: он ещё едет или дверь отказала.
              // Ноль при этом показывается — «в ленте ноль записей» это ответ,
              // а не отсутствие ответа.
              const count = item.count ? counts[item.count] : undefined;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`admin-tab${on ? " admin-tab--on" : ""}`}
                  aria-current={on ? "page" : undefined}
                  // Число рядом с именем читается глазом как часть вкладки,
                  // а вслух — как оторванная цифра. Подпись сшивает их обратно.
                  aria-label={count === undefined ? undefined : `${item.label}, ${count}`}
                >
                  {item.label}
                  {count !== undefined && (
                    <span className="admin-tab__count mono" aria-hidden="true">
                      {count}
                    </span>
                  )}
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
            {мои.map((s) => (
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
        {/* Крошки — только глубже навигации.
            Замер на экране заявок: раздел «Работа с клиентами» подсвечен
            в шапке, вкладка «Заявки» подсвечена и помечена aria-current,
            заголовок страницы говорит «Заявки» — и крошки говорили то же
            самое четвёртый раз, занимая 41 пиксель на каждом списке.
            До первой строки данных уходило 469 пикселей из 900, больше
            половины экрана.

            Там, где человек стоит глубже — карточка сделки, клиента, КП, —
            крошки остаются: навигация показывает раздел и вкладку, но не
            запись, и путь наверх есть только здесь. */}
        {!наСписке && (
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
        )}

        {/* Страница чужого контура. Портал ответит на неё 403, и без этой
            проверки человек увидел бы экран с полосой ошибки вместо
            объяснения. Адрес набирают руками и присылают ссылкой —
            спрятанный в шапке раздел этого не закрывает. */}
        {mayOpen(who, pathname ?? "") ? (
          children
        ) : (
          <div className="admin-head">
            <h1>Раздел закрыт</h1>
            <p className="admin-hint">
              У вашей учётной записи нет доступа к{" "}
              {contourName(contourOf(pathname ?? ""))}. Это не ошибка входа: вход
              выполнен, и остальные разделы работают. Права выдаёт тот, кто держит
              Keycloak — повторный вход ничего не изменит.
            </p>
          </div>
        )}
      </main>

      {/* Тонкая полоса вместо футера сайта: ссылки сайта здесь не нужны,
          а напоминание про периметр — нужно, и оно должно быть на экране
          и внизу длинного списка, а не только в шапке. */}
      <footer className="admin-foot">
        <span className="admin-foot__circuit">закрытый контур</span>
        <span className="admin-foot__say">
          Персональные данные не выносятся за периметр — ни снимком экрана, ни письмом.
        </span>
        {/* Список клавиш внизу, а не в шапке: он нужен один раз при знакомстве
            и потом почти никогда. Место в правом краю шапки стоит дороже. */}
        <button type="button" className="admin-foot__keys" onClick={() => setHotkeys(true)}>
          ? Горячие клавиши
        </button>
        <a className="admin-foot__link" href="/" target="_blank" rel="noreferrer">
          Публичный сайт →
        </a>
      </footer>

      {palette && <Palette onClose={() => setPalette(false)} />}
      {hotkeys && <Hotkeys onClose={() => setHotkeys(false)} />}

      {/* На самом разделе разговоров виджета нет: он повторял бы список,
          который человек уже открыл, и закрывал бы собой третью колонку. */}
      {!within(pathname, "/admin/chats/") && <Widget />}
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
    // Ссылка, а не просто блок: у кружка с именем в шапке ровно одно
    // назначение — попасть в свой профиль. До появления раздела «Команда»
    // вести ему было некуда, и блок был мёртвым местом на экране.
    <Link className="admin-who" href="/admin/profile/">
      {/* Кружок с инициалами появился не ради красоты: в журнале и на карточке
          сделки тот же кружок помечает, кто что сделал, и в шапке он говорит,
          какой именно кружок означает «я». Точка присутствия серая — портал
          присутствия не хранит, и зелёная точка была бы утверждением, которое
          никто не проверял. */}
      <Avatar name={who.actor} presence="unknown" />
      <span className="admin-who__lines">
        <span className="admin-who__name">{who.actor}</span>
        <span className="admin-who__meta">
          {who.roles.length > 0 ? who.roles.join(" · ") : "без ролей"}
        </span>
      </span>
    </Link>
  );
}

/**
 * Раздел текущей страницы.
 *
 * Сводка подсвечивается только на самой сводке: иначе она горит на каждой
 * странице, потому что её адрес — префикс всех остальных. Поэтому она стоит
 * первой и сверяется на точное совпадение, а не на префикс.
 */
function section(pathname: string | null, among: readonly Section[] = NAV): Section | undefined {
  if (!pathname) return undefined;
  return among.find(
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
