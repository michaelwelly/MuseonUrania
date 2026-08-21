"use client";

import Link from "next/link";
import { clients, deals, documents, leads, news, products, quotes } from "@/lib/admin";
import { Note, useLoad } from "./ui";

// Сводка.
//
// Сначала — что ждёт человека, потом — сколько чего всего. Порядок именно
// такой, потому что число само по себе не говорит, надо ли что-то делать:
// «12 документов» — это норма, а «3 без файла» — работа на сегодня.
// Витрина чисел выглядит содержательной и не отвечает на единственный
// вопрос, с которым сюда заходят утром.

type Summary = {
  products: { total: number; draft: number };
  news: { total: number; draft: number };
  documents: { total: number; published: number; awaitingFile: number };
  leads: { total: number; fresh: number };
  clients: number;
  deals: number;
  awaitingDecision: number;
};

/** Строка очереди: сколько, что это значит и куда идти. */
type Task = { count: number; what: string; why: string; href: string };

export default function Dashboard() {
  const { data, error, loading } = useLoad<Summary>(async () => {
    // Все запросы разом, а не по очереди: они независимы, и последовательный
    // вызов складывал бы задержки в сумму на ровном месте. Счётчики просят
    // одну строку — нужно только число в `total`, а не сама страница.
    const [p, n, d, all, draft, base, pipeline, sent] = await Promise.all([
      products(),
      news(),
      documents(),
      leads("", 0, 1),
      leads("draft", 0, 1),
      clients("", 0, 1),
      deals({}, 0, 1),
      quotes("sent", 0, 1),
    ]);

    return {
      products: { total: p.length, draft: p.filter((x) => !x.published).length },
      news: { total: n.length, draft: n.filter((x) => !x.published).length },
      documents: {
        total: d.length,
        published: d.filter((x) => x.published).length,
        awaitingFile: d.filter((x) => !x.hasFile).length,
      },
      leads: { total: all.total, fresh: draft.total },
      clients: base.total,
      deals: pipeline.total,
      awaitingDecision: sent.total,
    };
  });

  const tasks: Task[] = data
    ? [
        {
          count: data.leads.fresh,
          what: "заявок ждут разбора",
          why: "Заявка приходит черновиком. Пока статус не поднят, её никто не ведёт.",
          href: "/admin/leads/",
        },
        {
          count: data.awaitingDecision,
          what: "КП отправлены и ждут ответа",
          why: "Отправленное КП не правится. Решение клиента отмечается вручную.",
          href: "/admin/quotes/",
        },
        {
          count: data.documents.awaitingFile,
          what: "документов без файла",
          why: "Опубликовать документ без загруженного файла портал не даст.",
          href: "/admin/documents/",
        },
        {
          count: data.products.draft,
          what: "изделий в черновиках",
          why: "На сайте их нет: публикация — отдельное действие, не правка.",
          href: "/admin/products/",
        },
        {
          count: data.news.draft,
          what: "материалов в черновиках",
          why: "В ленту не попадут, пока не опубликованы.",
          href: "/admin/news/",
        },
      ].filter((t) => t.count > 0)
    : [];

  return (
    <>
      <div className="admin-head">
        <h1>Сводка</h1>
      </div>
      <p className="admin-hint">
        Публикация — всегда отдельное действие. Правка текста не выводит изделие на сайт
        и не снимает его оттуда: снятое с публикации возвращается дольше, чем публикуется.
      </p>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}

      {data && (
        <>
          <h2 className="admin-card__title">Требует внимания</h2>

          {tasks.length === 0 ? (
            <div className="queue queue--clear">
              Разобрано всё: заявки со статусами, документы с файлами, черновиков нет.
            </div>
          ) : (
            <div className="queue">
              {tasks.map((t) => (
                <Link key={t.href} className="queue__row" href={t.href}>
                  <span className="queue__count">{t.count}</span>
                  <span className="queue__what">
                    {t.what}
                    <span className="queue__why">{t.why}</span>
                  </span>
                  <span className="queue__go">Открыть →</span>
                </Link>
              ))}
            </div>
          )}

          <h2 className="admin-card__title" style={{ marginTop: "var(--s7)" }}>
            Всего в портале
          </h2>

          <div className="tiles">
            <Tile
              href="/admin/products/"
              num={data.products.total - data.products.draft}
              label={`изделий на сайте${всего(data.products.total)}`}
            />
            <Tile
              href="/admin/news/"
              num={data.news.total - data.news.draft}
              label={`материалов в ленте${всего(data.news.total)}`}
            />
            <Tile
              href="/admin/documents/"
              num={data.documents.published}
              label={`документов доступно${всего(data.documents.total)}`}
            />
            <Tile href="/admin/leads/" num={data.leads.total} label="заявок всего" />
            <Tile href="/admin/clients/" num={data.clients} label="клиентов в базе" />
            <Tile href="/admin/deals/" num={data.deals} label="сделок во всех воронках" />
          </div>
        </>
      )}
    </>
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

function Tile({ href, num, label }: { href: string; num: number; label: string }) {
  return (
    <Link className="tile" href={href}>
      <div className="tile__num">{num}</div>
      <div className="tile__label">{label}</div>
    </Link>
  );
}
