"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { quotes, type Page, type QuoteRow } from "@/lib/admin";
import { QUOTE_STATUS } from "../labels";
import { Empty, Note, State, day, money, useLoad, when } from "../ui";

// Коммерческие предложения по всем сделкам сразу.
//
// Заводятся они на карточке сделки — КП без сделки не бывает, и заводить его
// отсюда значило бы сначала спросить, к чему оно относится. Этот экран
// отвечает на другой вопрос: что сейчас у клиентов и что из этого ждёт
// ответа.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему в строке названо действие, а не «открыть»
//
// У КП пять состояний, и в каждом от человека требуется своё: черновик надо
// дописать, отправленное — дождаться и отметить решение, истекшее — составить
// заново. Одинаковое «Открыть» на всех пяти заставляет открыть, чтобы узнать,
// зачем открыли.
//
// ───────────────────────────────────────────────────────────────────────────
// Чего в списке нет
//
// Числа позиций. Оно есть только в самом КП: строка списка его не несёт,
// и получить его можно было бы только запросом на каждую строку. Восемь
// запросов ради колонки, которая ни на что не влияет, — плохая сделка.

/** Чем занят человек, глядя на КП в этом состоянии. */
const ДЕЙСТВИЕ: Record<string, string> = {
  draft: "Дописать",
  sent: "Отметить решение",
  expired: "Составить заново",
  rejected: "Составить заново",
  accepted: "Открыть",
};

/** Действие, которое двигает работу, набрано зелёным; остальные приглушены. */
const ЗОВЁТ = new Set(["draft", "sent", "expired", "rejected"]);

const ФИЛЬТРЫ: readonly { id: string; name: string }[] = [
  { id: "", name: "Все" },
  { id: "draft", name: "Черновики" },
  { id: "sent", name: "Отправлены" },
  { id: "accepted", name: "Приняты" },
  { id: "expired", name: "Истекли" },
];

export default function QuotesPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);

  const { data, error, loading } = useLoad<Page<QuoteRow>>(
    () => quotes(status, page),
    `${status}:${page}`,
  );

  return (
    <>
      <div className="admin-head">
        <h1>Коммерческие предложения</h1>
      </div>

      <p className="admin-hint">
        Правится только черновик. Отправленное КП уже лежит у клиента в почте, и правка
        задним числом означала бы, что портал и клиент держат разные версии одного
        предложения. Нужны другие условия — заводится новое КП со своим номером.
      </p>

      <div className="chips">
        {ФИЛЬТРЫ.map((f) => (
          <Chip
            key={f.id || "all"}
            name={f.name}
            status={f.id}
            on={status === f.id}
            onPick={() => {
              setStatus(f.id);
              setPage(0);
            }}
          />
        ))}
      </div>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}
      {data?.items.length === 0 && <Empty>КП с таким отбором нет.</Empty>}

      {data && data.items.length > 0 && (
        <>
          <div className="admin-scroll">
            <table className="admin-table admin-table--pick">
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Сделка</th>
                  <th>Сумма</th>
                  <th>Действует до</th>
                  <th>Статус</th>
                  <th>Отправлено</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((q) => (
                  <tr
                    key={q.id}
                    // Истекшее помечено полосой, а не только словом: в списке
                    // из тридцати строк слово «истекло» находится чтением,
                    // а полоса — взглядом.
                    className={q.status === "expired" ? "row--stop" : ""}
                    onClick={() => router.push(`/admin/quotes/${q.id}/`)}
                  >
                    <td className="tight mono row__name">{q.number}</td>
                    <td>
                      <Link
                        href={`/admin/deals/${q.dealId}/`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {q.dealTitle}
                      </Link>
                    </td>
                    <td className="tight mono num">{money(q.total, q.currency)}</td>
                    <td className="tight mono">{day(q.validUntil)}</td>
                    <td className="tight">
                      <State value={q.status} dict={QUOTE_STATUS} />
                    </td>
                    <td className="tight mono">{q.sentAt ? when(q.sentAt) : "—"}</td>
                    <td className="tight">
                      <Link
                        className={`row__do${ЗОВЁТ.has(q.status) ? " row__do--on" : ""}`}
                        href={`/admin/quotes/${q.id}/`}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`${ДЕЙСТВИЕ[q.status] ?? "Открыть"}: КП ${q.number}`}
                      >
                        {ДЕЙСТВИЕ[q.status] ?? "Открыть"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="under">
            <span className="under__count mono">
              Показаны {data.page * data.size + 1}–{data.page * data.size + data.items.length} из{" "}
              {data.total}
            </span>

            {data.pages > 1 && (
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
                  disabled={page + 1 >= data.pages}
                  onClick={() => setPage(page + 1)}
                >
                  Дальше
                </button>
              </span>
            )}
          </div>
        </>
      )}
    </>
  );
}

/** Чип отбора со счётчиком. Счётчик просит одну строку — нужен только `total`. */
function Chip({
  name,
  status,
  on,
  onPick,
}: {
  name: string;
  status: string;
  on: boolean;
  onPick: () => void;
}) {
  const { data } = useLoad<Page<QuoteRow>>(() => quotes(status, 0, 1), status);

  return (
    <span className={`chip${on ? " chip--on" : ""}`}>
      <button type="button" className="chip__pick" aria-pressed={on} onClick={onPick}>
        {name}
        {data && <span className="chip__count mono">{data.total}</span>}
      </button>
    </span>
  );
}
