"use client";

import Link from "next/link";
import { clients, deals, documents, leads, news, products, quotes } from "@/lib/admin";
import { Note, useLoad } from "./ui";

type Summary = {
  products: { total: number; published: number };
  news: { total: number; published: number };
  documents: { total: number; published: number; awaitingFile: number };
  leads: { total: number; fresh: number };
  clients: number;
  deals: number;
  awaitingDecision: number;
};

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
      products: { total: p.length, published: p.filter((x) => x.published).length },
      news: { total: n.length, published: n.filter((x) => x.published).length },
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
        <div className="tiles">
          <Tile
            href="/admin/products/"
            num={data.products.published}
            label={`изделий на сайте из ${data.products.total}`}
            note={
              data.products.total > data.products.published
                ? `${data.products.total - data.products.published} в черновиках`
                : undefined
            }
          />
          <Tile
            href="/admin/news/"
            num={data.news.published}
            label={`материалов в ленте из ${data.news.total}`}
          />
          <Tile
            href="/admin/documents/"
            num={data.documents.published}
            label={`документов доступно из ${data.documents.total}`}
            note={
              data.documents.awaitingFile > 0
                ? `${data.documents.awaitingFile} без загруженного файла`
                : undefined
            }
          />
          <Tile
            href="/admin/leads/"
            num={data.leads.fresh}
            label={`заявок в разборе из ${data.leads.total}`}
            note={data.leads.fresh > 0 ? "ждут статуса" : undefined}
          />
          <Tile href="/admin/clients/" num={data.clients} label="клиентов в базе" />
          <Tile href="/admin/deals/" num={data.deals} label="сделок во всех воронках" />
          <Tile
            href="/admin/quotes/"
            num={data.awaitingDecision}
            label="КП отправлено"
            note={data.awaitingDecision > 0 ? "ждут решения клиента" : undefined}
          />
        </div>
      )}
    </>
  );
}

function Tile({
  href,
  num,
  label,
  note,
}: {
  href: string;
  num: number;
  label: string;
  note?: string;
}) {
  return (
    <Link className="tile" href={href}>
      <div className="tile__num">{num}</div>
      <div className="tile__label">{label}</div>
      {note && <div className="tile__note">{note}</div>}
    </Link>
  );
}
