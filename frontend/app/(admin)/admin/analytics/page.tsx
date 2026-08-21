"use client";

import { useState } from "react";
import { LEAD_LANGUAGE, LEAD_SOURCE, label } from "../labels";
import { analytics, analyticsDimensions, type Analytics } from "@/lib/admin";
import { Note, money, useLoad } from "../ui";

// Воронка в четырёх разрезах.
//
// Отчёт считается по заявкам, а не по сделкам: атрибуция — свойство того,
// откуда человек пришёл. Сделка, заведённая руками, в разрезы не попадает,
// потому что её никто не приводил, и приписывать её кампании значит завысить
// эффект кампании.

/*
 * Как называется значение разреза.
 *
 * Подписываются только замкнутые наборы: источник и язык заданы ограничением
 * схемы. По изделию ключ — это slug, по кампании — произвольная utm-метка;
 * переводить их нечем и не нужно, они и есть то, что искали.
 */
function значение(dimension: string, key: string): string {
  if (dimension === "source") return label(LEAD_SOURCE, key);
  if (dimension === "language") return label(LEAD_LANGUAGE, key);
  return key;
}

const DIMENSION_LABEL: Record<string, string> = {
  product: "по изделию",
  source: "по источнику",
  language: "по языку",
  campaign: "по кампании",
};

export default function AnalyticsPage() {
  const [by, setBy] = useState("source");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: dimensions } = useLoad<string[]>(analyticsDimensions);
  const { data, error, loading } = useLoad<Analytics>(
    () => analytics(by, from, to),
    `${by}:${from}:${to}`,
  );

  return (
    <>
      <div className="admin-head">
        <h1>Аналитика</h1>
        <div className="row">
          <select className="admin-select" value={by}
            aria-label="Разрез аналитики" onChange={(e) => setBy(e.target.value)}>
            {(dimensions ?? []).map((d) => (
              <option key={d} value={d}>
                {DIMENSION_LABEL[d] ?? d}
              </option>
            ))}
          </select>
          <input
            className="admin-select"
            type="date"
            value={from}
            aria-label="Начало периода"
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            className="admin-select"
            type="date"
            value={to}
            aria-label="Конец периода"
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>
      <p className="admin-hint">
        Заявка, не ставшая сделкой, попадает в отчёт наравне с остальными — иначе конверсия
        везде равна единице. Незаполненное значение разреза показывается как «—», а не
        прячется: заявки без кампании — это тоже ответ.
      </p>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}
      {data?.rows.length === 0 && (
        <p className="admin-hint">За этот период заявок не было.</p>
      )}

      {data && data.rows.length > 0 && (
        <div className="admin-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{DIMENSION_LABEL[data.by] ?? data.by}</th>
                <th>Заявок</th>
                <th>Сделок</th>
                <th>Выиграно</th>
                <th>Проиграно</th>
                <th>Конверсия</th>
                <th>Сумма выигранных</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.key}>
                  <td>{значение(data.by, row.key)}</td>
                  <td className="tight">{row.leads}</td>
                  <td className="tight">{row.deals}</td>
                  <td className="tight">{row.won}</td>
                  <td className="tight">{row.lost}</td>
                  <td className="tight">{share(row.won, row.leads)}</td>
                  <td className="tight">{money(row.wonAmount, null)}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Итого</strong>
                </td>
                <td className="tight">
                  <strong>{data.totals.leads}</strong>
                </td>
                <td className="tight">
                  <strong>{data.totals.deals}</strong>
                </td>
                <td className="tight">
                  <strong>{data.totals.won}</strong>
                </td>
                <td className="tight">
                  <strong>{data.totals.lost}</strong>
                </td>
                <td className="tight">
                  <strong>{share(data.totals.won, data.totals.leads)}</strong>
                </td>
                <td className="tight">
                  <strong>{money(data.totals.wonAmount, null)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// Доля выигранных от заявок. Ноль заявок — прочерк, а не «0%»: ноль из нуля
// не равен нулю, он не считается вовсе.
function share(won: number, leads: number): string {
  if (!leads) return "—";
  return `${Math.round((won / leads) * 100)}%`;
}
