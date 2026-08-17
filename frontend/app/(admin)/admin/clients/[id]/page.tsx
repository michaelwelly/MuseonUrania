"use client";

import Link from "next/link";
import { use, useState } from "react";
import {
  client as loadClient,
  clientKinds,
  eraseClientData,
  deals as loadDeals,
  type Client,
  type DealRow,
  type Page,
} from "@/lib/admin";
import EraseData from "../../EraseData";
import ClientEditor from "../ClientEditor";
import History from "../../History";
import { PIPELINE, STAGE, label } from "../../labels";
import { Note, money, useLoad, when } from "../../ui";

export default function ClientCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, reload } = useLoad<Client>(() => loadClient(id), id);
  const { data: kinds } = useLoad<string[]>(clientKinds);
  const { data: theirDeals } = useLoad<Page<DealRow>>(
    () => loadDeals({ clientId: id }, 0, 200),
    id,
  );

  // Заголовок после сохранения меняется вместе с наименованием: карточка,
  // озаглавленная старым именем, читается как чужая.
  const [name, setName] = useState<string | null>(null);

  return (
    <>
      <div className="admin-head">
        <h1>{name ?? data?.name ?? "Клиент"}</h1>
        {data && <span className="mono">версия {data.version}</span>}
      </div>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}

      {data && (
        <>
          {/* key по клиенту: без него React переиспользовал бы состояние формы
              при переходе от одной карточки к другой и показал бы чужие поля. */}
          <ClientEditor
            key={data.id}
            existing={data}
            kinds={kinds ?? ["company", "person"]}
            onSaved={(saved) => setName(saved.name)}
          />

          <div className="admin-card">
            <div className="admin-card__head">
              <h2 className="admin-card__title">Сделки</h2>
              <Link className="btn btn--small" href={`/admin/deals/new/?client=${data.id}`}>
                Завести сделку
              </Link>
            </div>

            {theirDeals?.items.length === 0 && (
              <p className="admin-hint">По этому клиенту сделок ещё нет.</p>
            )}

            {theirDeals && theirDeals.items.length > 0 && (
              <div className="admin-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Сделка</th>
                      <th>Воронка</th>
                      <th>Стадия</th>
                      <th>Сумма</th>
                      <th>Заведена</th>
                    </tr>
                  </thead>
                  <tbody>
                    {theirDeals.items.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link href={`/admin/deals/${row.id}/`}>{row.title}</Link>
                        </td>
                        <td className="tight">
                          <span className="badge">{label(PIPELINE, row.pipeline)}</span>
                        </td>
                        <td className="tight">{label(STAGE, row.stage)}</td>
                        <td className="tight">{money(row.amount, row.currency)}</td>
                        <td className="tight muted">{when(row.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <History of="clients" id={data.id} />

          {/* Обращение субъекта по карточке клиента. Наименование организации
              не трогается — юрлицо персональными данными не является; у частного
              лица стирается и оно. */}
          <EraseData
            what="почта, телефон, заметка и вся история переписки по клиенту"
            erase={() => eraseClientData(data.id)}
            onDone={reload}
          />
        </>
      )}
    </>
  );
}
