"use client";

import Link from "next/link";
import { useState } from "react";
import {
  NOBODY,
  audit,
  chatQueue,
  clients,
  deals,
  documents,
  leads,
  news,
  products,
  quotes,
  staff as loadStaff,
  type AuditEntry,
  type Page,
  type StaffMember,
} from "@/lib/admin";
import { plural } from "@/lib/plural";
import { AUDIT_ACTION, label } from "./labels";
import { useStored } from "./lists";
import { Note, useLoad, when } from "./ui";
import { useWho } from "./who";

// Сводка.
//
// Сначала — что ждёт человека, потом — сколько чего всего. Порядок именно
// такой, потому что число само по себе не говорит, надо ли что-то делать:
// «12 документов» — это норма, а «3 без файла» — работа на сегодня.
// Витрина чисел выглядит содержательной и не отвечает на единственный
// вопрос, с которым сюда заходят утром.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему у каждой строки своё слово на кнопке
//
// «Открыть →» одинаково у всех восьми строк отвечает на вопрос «куда»,
// а вопрос был «что делать». Разговор ждёт ответа, заявка — разбора,
// документ — файла, и слово на кнопке и есть ответ, ради которого сюда
// заходят утром.

type Summary = {
  products: { total: number; draft: number };
  news: { total: number; draft: number };
  documents: { total: number; published: number; awaitingFile: number };
  leads: { total: number; fresh: number; nobody: number };
  waitingChats: number;
  clients: number;
  deals: number;
  awaitingDecision: number;
  expiredQuotes: number;
};

/** Строка очереди: сколько, что это значит, зачем и что с этим делать. */
type Task = {
  count: number;
  what: string;
  why: string;
  action: string;
  href: string;
  /** Насколько горит: посетитель ждёт сейчас, остальное — до конца дня. */
  tone: "danger" | "wait" | "flat";
};

/*
 * Подписи очереди согласуются с числом.
 *
 * lib/plural написан ровно под эту ошибку — «4 моделей» на сайте. В сводке
 * ровно то же: «1 разговоров ждут ответа», «4 клиентов в базе». Числа здесь
 * считаются от данных и меняются каждый день, значит и форма слова обязана
 * считаться, а не стоять константой.
 */
const склонения = {
  разговоры: (n: number) =>
    plural(n, "разговор ждёт ответа", "разговора ждут ответа", "разговоров ждут ответа"),
  заявки: (n: number) =>
    plural(n, "заявка ждёт разбора", "заявки ждут разбора", "заявок ждут разбора"),
  ничьи: (n: number) =>
    plural(
      n,
      "заявка без ответственного",
      "заявки без ответственного",
      "заявок без ответственного",
    ),
  кп: (n: number) =>
    plural(
      n,
      "КП отправлено и ждёт ответа",
      "КП отправлены и ждут ответа",
      "КП отправлены и ждут ответа",
    ),
  истекло: (n: number) => plural(n, "КП истекло", "КП истекли", "КП истекли"),
  документы: (n: number) =>
    plural(n, "документ без файла", "документа без файла", "документов без файла"),
  изделия: (n: number) =>
    plural(n, "изделие в черновиках", "изделия в черновиках", "изделий в черновиках"),
  материалы: (n: number) =>
    plural(n, "материал в черновиках", "материала в черновиках", "материалов в черновиках"),
};

export default function Dashboard() {
  const who = useWho();
  const [hints, setHints] = useStored<boolean>("vedal.admin.hints", true);
  // Время дня берётся один раз при открытии: сводку не держат открытой
  // до полуночи, а если держат — «доброе утро» в час ночи смешнее,
  // чем неверно.
  const [now] = useState(() => new Date());

  const { data, error, loading } = useLoad<Summary>(async () => {
    // Все запросы разом, а не по очереди: они независимы, и последовательный
    // вызов складывал бы задержки в сумму на ровном месте. Счётчики просят
    // одну строку — нужно только число в `total`, а не сама страница.
    const [p, n, d, all, fresh, ничьи, base, pipeline, sent, expired, waiting] =
      await Promise.all([
        products(),
        news(),
        documents(),
        leads({}, 0, 1),
        leads({ status: "draft" }, 0, 1),
        leads({ owner: NOBODY }, 0, 1),
        clients("", 0, 1),
        deals({}, 0, 1),
        quotes("sent", 0, 1),
        quotes("expired", 0, 1),
        chatQueue(0, 1),
      ]);

    return {
      products: { total: p.length, draft: p.filter((x) => !x.published).length },
      news: { total: n.length, draft: n.filter((x) => !x.published).length },
      documents: {
        total: d.length,
        published: d.filter((x) => x.published).length,
        awaitingFile: d.filter((x) => !x.hasFile).length,
      },
      leads: { total: all.total, fresh: fresh.total, nobody: ничьи.total },
      waitingChats: waiting.total,
      clients: base.total,
      deals: pipeline.total,
      awaitingDecision: sent.total,
      expiredQuotes: expired.total,
    };
  });

  const tasks: Task[] = data
    ? ([
        {
          // Первой строкой, и это не про важность, а про время.
          //
          // Замер прошлой сессии: разговор ждал живого ответа четвёртый день,
          // а сводка о нём молчала — она считала заявки, документы, изделия,
          // новости и КП, но не людей, которые ждут прямо сейчас. Черновик
          // подождёт до конца дня, посетитель — нет.
          count: data.waitingChats,
          what: склонения.разговоры(data.waitingChats),
          why: "Посетитель ждёт живого ответа. Ваш ответ и есть взятие разговора.",
          action: "Ответить",
          href: "/admin/chats/",
          tone: "danger",
        },
        {
          count: data.leads.nobody,
          what: склонения.ничьи(data.leads.nobody),
          why: "Не потеряна, но и не взята: пока ответственного нет, её никто не ведёт.",
          action: "Назначить",
          href: "/admin/leads/",
          tone: "wait",
        },
        {
          count: data.leads.fresh,
          what: склонения.заявки(data.leads.fresh),
          why: "Заявка приходит черновиком. Пока статус не поднят, работа по ней не идёт.",
          action: "Разобрать",
          href: "/admin/leads/",
          tone: "wait",
        },
        {
          count: data.expiredQuotes,
          what: склонения.истекло(data.expiredQuotes),
          why: "Срок вышел. Нужны прежние условия — составляется новое КП со своим номером.",
          action: "Составить заново",
          href: "/admin/quotes/",
          tone: "wait",
        },
        {
          count: data.awaitingDecision,
          what: склонения.кп(data.awaitingDecision),
          why: "Отправленное КП не правится. Решение клиента отмечается вручную.",
          action: "Отметить решение",
          href: "/admin/quotes/",
          tone: "wait",
        },
        {
          count: data.documents.awaitingFile,
          what: склонения.документы(data.documents.awaitingFile),
          why: "Опубликовать документ без загруженного файла портал не даст.",
          action: "Загрузить",
          href: "/admin/documents/",
          tone: "flat",
        },
        {
          count: data.products.draft,
          what: склонения.изделия(data.products.draft),
          why: "На сайте их нет: публикация — отдельное действие, не правка.",
          action: "Проверить",
          href: "/admin/products/",
          tone: "flat",
        },
        {
          count: data.news.draft,
          what: склонения.материалы(data.news.draft),
          why: "В ленту не попадут, пока не опубликованы.",
          action: "Проверить",
          href: "/admin/news/",
          tone: "flat",
        },
        // Строка с нулём не показывается вовсе: «0 документов без файла» —
        // это не работа, а шум, и в списке дел ему не место.
      ] as Task[]).filter((t) => t.count > 0)
    : [];

  return (
    <>
      <div className="admin-head">
        <div className="deal__head">
          <p className="hello__date mono">{дата(now)}</p>
          <h1>
            {приветствие(now)}, <Greeting login={who.actor} />
          </h1>
        </div>

        <div className="row">
          <Link className="btn" href="/admin/news/new/">
            Добавить материал
          </Link>
          <Link className="btn btn--primary" href="/admin/deals/new/">
            Новая сделка
          </Link>
        </div>
      </div>

      {hints && (
        <div className="hints">
          <span className="hints__mark" aria-hidden="true">
            ?
          </span>
          <div className="hints__body">
            <p className="hints__title">Три правила, из которых следует остальное</p>
            <p className="hints__text">
              Публикация — всегда отдельное действие: правка текста не выводит изделие
              на сайт и не снимает его оттуда. Незаполненное помечается «ожидает уточнения»,
              а не заполняется правдоподобным. Цены, сроки поставки и клинические заявления
              наружу не идут.
            </p>
            <p className="hints__links">
              <Link href="/admin/products/">Продукция</Link>
              <Link href="/admin/leads/">Заявки</Link>
              <Link href="/admin/audit/">Журнал</Link>
            </p>
          </div>
          <button
            type="button"
            className="hints__close"
            onClick={() => setHints(false)}
            aria-label="Убрать подсказку"
          >
            ×
          </button>
        </div>
      )}

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}

      {data && (
        <div className="board2">
          <section>
            <h2 className="admin-card__title">Требует внимания</h2>

            {tasks.length === 0 ? (
              <div className="queue queue--clear">
                Разобрано всё: никто не ждёт ответа, заявки со статусами, документы
                с файлами, черновиков нет.
              </div>
            ) : (
              <div className="queue">
                {tasks.map((t) => (
                  <Link key={t.action + t.href} className="queue__row" href={t.href}>
                    <span className={`queue__count queue__count--${t.tone}`}>{t.count}</span>
                    <span className="queue__what">
                      {t.what}
                      <span className="queue__why">{t.why}</span>
                    </span>
                    <span className="queue__go">{t.action} →</span>
                  </Link>
                ))}
              </div>
            )}

            <h2 className="admin-card__title">Последние события</h2>
            <Recent />
          </section>

          <section>
            <h2 className="admin-card__title">Всего в портале</h2>

            <div className="tiles">
              <Tile
                href="/admin/products/"
                num={data.products.total - data.products.draft}
                label={`${plural(data.products.total - data.products.draft, "изделие", "изделия", "изделий")} на сайте${всего(data.products.total)}`}
              />
              <Tile
                href="/admin/news/"
                num={data.news.total - data.news.draft}
                label={`${plural(data.news.total - data.news.draft, "материал", "материала", "материалов")} в ленте${всего(data.news.total)}`}
              />
              <Tile
                href="/admin/documents/"
                num={data.documents.published}
                label={`${plural(data.documents.published, "документ доступен", "документа доступны", "документов доступно")}${всего(data.documents.total)}`}
              />
              <Tile
                href="/admin/leads/"
                num={data.leads.total}
                label={`${plural(data.leads.total, "заявка", "заявки", "заявок")} всего`}
              />
              <Tile
                href="/admin/clients/"
                num={data.clients}
                label={`${plural(data.clients, "клиент", "клиента", "клиентов")} в базе`}
              />
              <Tile
                href="/admin/deals/"
                num={data.deals}
                label={`${plural(data.deals, "сделка", "сделки", "сделок")} во всех воронках`}
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}

/**
 * Имя вошедшего для приветствия.
 *
 * `session()` отдаёт логин, а здороваться «Доброе утро, i.koltsova» —
 * это здороваться с учётной записью, а не с человеком. Имя лежит
 * в справочнике сотрудников; не нашлось — здороваемся тем, что есть.
 *
 * Имя берётся целиком. Сначала бралось первое слово — чтобы не выходило
 * «Доброе утро, Кольцова Ирина Петровна», — и на стенде это дало
 * «Добрый вечер, Локальный»: в справочнике там служебная запись
 * «Локальный редактор». Отличить имя от прилагательного нечем, а имя,
 * обрезанное по догадке, читается как ошибка портала.
 */
function Greeting({ login }: { login: string }) {
  const { data } = useLoad<StaffMember[]>(loadStaff);
  const человек = data?.find((p) => p.login === login);
  return <>{человек?.name?.trim() || login}</>;
}

/** Пять последних записей журнала — человеческими фразами, как и сам журнал. */
function Recent() {
  const { data, error } = useLoad<Page<AuditEntry>>(() => audit({}, 0, 5));

  if (error) return <p className="admin-hint">Журнал сейчас недоступен.</p>;
  if (!data) return <p className="muted">Загружаем…</p>;
  if (data.items.length === 0) return <p className="admin-hint">Записей пока нет.</p>;

  return (
    <div className="recent">
      {data.items.map((row) => (
        <Link key={row.id} className="recent__row" href="/admin/audit/">
          <span className="recent__when mono">{when(row.at)}</span>
          <span className="recent__what">{label(AUDIT_ACTION, row.action)}</span>
        </Link>
      ))}
    </div>
  );
}

/**
 * Хвост «из N» — только когда есть из чего выбирать.
 *
 * «0 материалов в ленте из 0» звучит как поломка счётчика, хотя означает
 * пустую ленту. Ноль из нуля — не доля, и говорить о ней нечего.
 */
function всего(total: number): string {
  return total > 0 ? ` из ${total}` : "";
}

/** Время суток по часам, а не по расписанию: смены здесь нет. */
function приветствие(now: Date): string {
  const час = now.getHours();
  if (час < 5) return "Доброй ночи";
  if (час < 12) return "Доброе утро";
  if (час < 18) return "Добрый день";
  return "Добрый вечер";
}

function дата(now: Date): string {
  return now.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function Tile({ href, num, label }: { href: string; num: number; label: string }) {
  return (
    <Link className="tile" href={href}>
      <div className="tile__num">{num}</div>
      <div className="tile__label">{label}</div>
    </Link>
  );
}
