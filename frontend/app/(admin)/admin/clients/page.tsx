"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  client as loadClient,
  clients,
  deals as loadDeals,
  type Client,
  type ClientRow,
  type DealRow,
  type Page,
} from "@/lib/admin";
import { SearchIcon } from "../icons";
import { CLIENT_KIND, PIPELINE, STAGE, label } from "../labels";
import { Empty, Note, State, money, useLoad, when } from "../ui";

// Клиентская база.
//
// Вторая страница админки после заявок, где на экране персональные данные, —
// отсюда потолок размера страницы на портале.
//
// ───────────────────────────────────────────────────────────────────────────
// Зачем боковая панель
//
// Вопрос «кто это и сколько с ним сделок» задают, не собираясь ничего править:
// клиент позвонил, надо вспомнить. Раньше на него отвечал переход в карточку
// и переход обратно — два перехода, и список каждый раз читался заново
// с первой строки, потому что возвращался он на неё.
//
// Панель отвечает, не уводя со списка. Правка осталась там, где была:
// в карточке. Это не «просмотр вместо карточки», а ответ на другой вопрос.

export default function ClientsPage() {
  // Введённое и применённое разведены намеренно: с одним состоянием запрос
  // уходил бы на каждую нажатую букву, а поиск идёт по всей базе.
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const { data, error, loading } = useLoad<Page<ClientRow>>(
    () => clients(query, page),
    `${query}:${page}`,
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(typed.trim());
      setPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [typed]);

  const rows = useMemo(() => data?.items ?? [], [data]);

  // Открытая панель обязана относиться к строке, которая есть на экране.
  // Иначе после смены страницы справа висит карточка клиента, которого
  // в списке нет, и непонятно, откуда она взялась.
  const выбран = open && rows.some((r) => r.id === open) ? open : null;

  return (
    <>
      <div className="admin-head">
        <h1>Клиенты</h1>
        <div className="row">
          <label className="find">
            <SearchIcon size={16} />
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Наименование или ИНН"
              aria-label="Поиск по клиентской базе"
              autoComplete="off"
            />
          </label>
          <Link className="btn btn--primary" href="/admin/clients/new/">
            Завести клиента
          </Link>
        </div>
      </div>

      <p className="admin-pd">На экране персональные данные</p>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}
      {data && rows.length === 0 && (
        <Empty>{query ? "По этому запросу никого нет." : "Клиентов пока нет."}</Empty>
      )}

      {rows.length > 0 && (
        <div className="with-side">
          <div>
            <div className="admin-scroll">
              <table className="admin-table admin-table--pick">
                <thead>
                  <tr>
                    <th>Клиент</th>
                    <th>ИНН</th>
                    <th>Город</th>
                    <th>Сделки</th>
                    <th>Ответственный</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className={выбран === row.id ? "row--on" : ""}
                      onClick={() => setOpen(row.id)}
                    >
                      <td>
                        <span className="row__name">{row.name}</span>
                        <span className="row__under">{label(CLIENT_KIND, row.kind)}</span>
                      </td>
                      <td className="tight mono">{row.inn || "—"}</td>
                      <td className="tight">{row.city || "—"}</td>
                      <td className="tight mono">{row.deals}</td>
                      <td className="tight">
                        {row.owner || <span className="nobody">не назначен</span>}
                      </td>
                      <td className="tight">
                        <Link
                          className="row__go"
                          href={`/admin/clients/${row.id}/`}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Правка карточки: ${row.name}`}
                        >
                          правка
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="under">
              <span className="under__count mono">
                Показаны {data!.page * data!.size + 1}–{data!.page * data!.size + rows.length} из{" "}
                {data!.total}
              </span>

              {data!.pages > 1 && (
                <span className="under__pager">
                  <button
                    className="btn btn--small"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    Назад
                  </button>
                  <button
                    className="btn btn--small"
                    disabled={page + 1 >= data!.pages}
                    onClick={() => setPage(page + 1)}
                  >
                    Дальше
                  </button>
                </span>
              )}
            </div>
          </div>

          <aside className="side">
            {выбран ? (
              <Preview key={выбран} id={выбран} onClose={() => setOpen(null)} />
            ) : (
              <p className="side__idle">
                Выберите строку — карточка покажется здесь, не уводя со списка.
              </p>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

/**
 * Карточка клиента без ухода со списка.
 *
 * Сделки грузятся отдельным запросом: в строке списка их только число,
 * а вопрос «что с ним сейчас» — это именно перечень со стадиями и суммами.
 */
function Preview({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error, loading } = useLoad<Client>(() => loadClient(id), id);
  const { data: deals } = useLoad<Page<DealRow>>(() => loadDeals({ clientId: id }, 0, 10), id);

  return (
    <div className="side__card">
      <div className="side__head">
        <span className="side__eyebrow mono">Просмотр без ухода со списка</span>
        <button
          type="button"
          className="side__close"
          onClick={onClose}
          aria-label="Закрыть просмотр"
        >
          ×
        </button>
      </div>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}

      {data && (
        <>
          <h2 className="side__title">{data.name}</h2>

          <dl className="pairs">
            <Pair name="Вид" value={label(CLIENT_KIND, data.kind)} />
            <Pair name="ИНН" value={data.inn} mono />
            <Pair name="КПП" value={data.kpp} mono />
            <Pair name="Город" value={[data.country, data.city].filter(Boolean).join(", ")} />
            <Pair name="Телефон" value={data.phone} mono />
            <Pair name="Почта" value={data.email} mono />
            <Pair name="Ответственный" value={data.owner} empty="не назначен" />
            <Pair name="Заведён" value={when(data.createdAt)} mono />
          </dl>

          <p className="side__label mono">Сделки</p>
          {deals && deals.items.length === 0 && (
            <p className="side__idle">Сделок по этому клиенту нет.</p>
          )}
          {deals?.items.map((deal) => (
            <Link key={deal.id} className="side__deal" href={`/admin/deals/${deal.id}/`}>
              <span className="side__deal-top">
                <span className="side__deal-name">{deal.title}</span>
                <span className="side__deal-sum mono">{money(deal.amount, deal.currency)}</span>
              </span>
              <span className="side__deal-under">
                <State value={deal.stage} dict={STAGE} />
                <span className="muted">{label(PIPELINE, deal.pipeline)}</span>
              </span>
            </Link>
          ))}

          <div className="side__actions">
            <Link className="btn btn--small" href={`/admin/clients/${data.id}/`}>
              Открыть карточку
            </Link>
            <Link className="btn btn--small" href={`/admin/deals/new/?client=${data.id}`}>
              Завести сделку
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/** Пара «ключ — значение». Пустое — прочерк, а не исчезнувшая строка:
 *  отсутствие ИНН у клиента это факт, и видеть его надо.
 *
 *  Там, где у пустоты есть имя, оно называется: «не назначен» читается
 *  так же, как в списке заявок, и означает то же самое. Прочерк на этом
 *  месте заставлял бы догадываться. */
function Pair({
  name,
  value,
  mono,
  empty = "—",
}: {
  name: string;
  value: string | null;
  mono?: boolean;
  empty?: string;
}) {
  const пусто = !value;
  return (
    <div className="pairs__row">
      <dt>{name}</dt>
      <dd className={пусто ? (empty === "—" ? undefined : "nobody") : mono ? "mono" : undefined}>
        {value || empty}
      </dd>
    </div>
  );
}
