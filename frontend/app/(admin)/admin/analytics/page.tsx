"use client";

import { useState } from "react";
import { analytics, analyticsDimensions, type Analytics } from "@/lib/admin";
import { LEAD_LANGUAGE, LEAD_SOURCE, label } from "../labels";
import { Note, Segments, day, money, useLoad } from "../ui";

// Воронка в четырёх разрезах.
//
// Отчёт считается по заявкам, а не по сделкам: атрибуция — свойство того,
// откуда человек пришёл. Сделка, заведённая руками, в разрезы не попадает,
// потому что её никто не приводил, и приписывать её кампании значит завысить
// эффект кампании.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему полосы, а не круговая диаграмма
//
// Вопрос к этому экрану один: где теряются заявки. Ответ на него — три числа
// подряд, где каждое меньше предыдущего, и разница между ними и есть потеря.
// Полосы одной шкалы показывают эту разницу длиной; круг показывает доли
// целого, а целого здесь нет — заявка, ставшая сделкой, не перестаёт быть
// заявкой.
//
// ───────────────────────────────────────────────────────────────────────────
// Про сравнение с прошлым периодом
//
// Оно появляется, только когда период задан обеими границами: сравнивать
// «всё время» не с чем. Предыдущий период берётся той же длины и вплотную —
// иначе «на 30% больше» означает «больше, чем за какие-то другие дни»,
// а это не сравнение, а совпадение.

const РАЗРЕЗ: Record<string, string> = {
  source: "Источник",
  form: "Форма",
  product: "Изделие",
  language: "Язык",
  campaign: "Кампания",
};

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
  return key || "—";
}

export default function AnalyticsPage() {
  const [by, setBy] = useState("source");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: dimensions } = useLoad<string[]>(analyticsDimensions);
  const { data, error, loading } = useLoad<Analytics>(
    () => analytics(by, from, to),
    `${by}:${from}:${to}`,
  );

  // Прошлый период — только когда есть с чем сравнивать.
  const прошлый = предыдущий(from, to);
  const { data: было } = useLoad<Analytics | null>(
    () => (прошлый ? analytics(by, прошлый.from, прошлый.to) : Promise.resolve(null)),
    `${by}:${прошлый?.from ?? ""}:${прошлый?.to ?? ""}`,
  );

  const итого = data?.totals;

  return (
    <>
      <div className="admin-head">
        <h1>Аналитика</h1>
        <div className="row">
          <Segments
            label="Разрез"
            value={by}
            options={dimensions ?? [by]}
            dict={РАЗРЕЗ}
            onChange={setBy}
          />
          <label className="find">
            <span className="slug__prefix mono">с</span>
            <input
              className="mono"
              type="date"
              value={from}
              aria-label="Начало периода"
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="find">
            <span className="slug__prefix mono">по</span>
            <input
              className="mono"
              type="date"
              value={to}
              aria-label="Конец периода"
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      </div>

      <p className="admin-hint">
        Заявка, не ставшая сделкой, попадает в отчёт наравне с остальными — иначе конверсия
        везде равна единице. Незаполненное значение разреза показывается как «—», а не
        прячется: заявки без кампании — это тоже ответ.
      </p>

      <p className="period mono">
        {from || to
          ? `Период: ${from ? day(from) : "с начала"} — ${to ? day(to) : "по сегодня"}`
          : "Период: всё время"}
        {прошлый && (
          <span className="period__vs">
            сравнение с {day(прошлый.from)} — {day(прошлый.to)}
          </span>
        )}
      </p>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}
      {data?.rows.length === 0 && <p className="admin-hint">За этот период заявок не было.</p>}

      {data && итого && data.rows.length > 0 && (
        <>
          <div className="tiles">
            <Plate name="Заявок" value={итого.leads} was={было?.totals.leads} />
            <Plate name="Стали сделками" value={итого.deals} was={было?.totals.deals} />
            <Plate name="Выиграно" value={итого.won} was={было?.totals.won} />
            <Plate
              name="Конверсия"
              value={доля(итого.won, итого.leads)}
              was={было ? доля(было.totals.won, было.totals.leads) : undefined}
              суффикс="%"
            />
          </div>

          <h2 className="admin-card__title">Путь заявки</h2>
          <div className="admin-card">
            <Track name="Пришло заявок" value={итого.leads} of={итого.leads} />
            <Track name="Стали сделками" value={итого.deals} of={итого.leads} />
            <Track name="Выиграно" value={итого.won} of={итого.leads} />
            <Track name="Проиграно" value={итого.lost} of={итого.leads} stop />
            <p className="admin-hint">
              Каждая полоса меряется от числа заявок, а не от предыдущей: так видно, где
              теряется, а не только сколько осталось. Выигранное и проигранное вместе меньше
              числа сделок — остальные ещё в работе.
            </p>
          </div>

          <h2 className="admin-card__title">{РАЗРЕЗ[data.by] ?? data.by}</h2>
          <div className="admin-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{РАЗРЕЗ[data.by] ?? data.by}</th>
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
                    <td className="tight mono num">{row.leads}</td>
                    <td className="tight mono num">{row.deals}</td>
                    <td className="tight mono num">{row.won}</td>
                    <td className="tight mono num">{row.lost}</td>
                    <td className="tight mono num">{процент(row.won, row.leads)}</td>
                    <td className="tight mono num">{money(row.wonAmount, null)}</td>
                  </tr>
                ))}

                {/* Итоговая строка на подложке: её ищут глазами первой,
                    а в ряду одинаковых строк она теряется. */}
                <tr className="row--total">
                  <td>Итого</td>
                  <td className="tight mono num">{итого.leads}</td>
                  <td className="tight mono num">{итого.deals}</td>
                  <td className="tight mono num">{итого.won}</td>
                  <td className="tight mono num">{итого.lost}</td>
                  <td className="tight mono num">{процент(итого.won, итого.leads)}</td>
                  <td className="tight mono num">{money(итого.wonAmount, null)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

/**
 * Плитка с числом и изменением.
 *
 * Изменение показывается только когда есть с чем сравнивать. Стрелка вверх
 * не всегда «хорошо»: рост проигранных — это рост проигранных, и красить его
 * зелёным значило бы поздравлять с потерей. Поэтому цвет здесь про рост
 * и падение, а не про добро и зло, и стоит он только у тех плиток, где рост
 * действительно лучше.
 */
function Plate({
  name,
  value,
  was,
  суффикс = "",
}: {
  name: string;
  value: number;
  was?: number;
  суффикс?: string;
}) {
  const разница = was === undefined ? null : value - was;

  return (
    <div className="tile tile--flat">
      <div className="tile__num">
        {value}
        {суффикс}
      </div>
      <div className="tile__label">{name}</div>
      {разница !== null && (
        <div
          className={`tile__delta${разница > 0 ? " tile__delta--up" : разница < 0 ? " tile__delta--down" : ""}`}
        >
          {разница === 0
            ? "столько же"
            : `${разница > 0 ? "+" : "−"}${Math.abs(разница)}${суффикс} к прошлому периоду`}
        </div>
      )}
    </div>
  );
}

/** Полоса пути. Длина считается от числа заявок — общей шкалы для всех. */
function Track({
  name,
  value,
  of,
  stop,
}: {
  name: string;
  value: number;
  of: number;
  stop?: boolean;
}) {
  const доля = of > 0 ? Math.round((value / of) * 100) : 0;

  return (
    <div className="track">
      <span className="track__name">{name}</span>
      <span className="track__bar" aria-hidden="true">
        <span
          className={`track__fill${stop ? " track__fill--stop" : ""}`}
          style={{ width: `${доля}%` }}
        />
      </span>
      <span className="track__num mono">
        {value}
        <span className="track__share">{of > 0 ? ` · ${доля}%` : ""}</span>
      </span>
    </div>
  );
}

/** Доля выигранных от заявок числом. Ноль заявок — ноль, а не деление на ноль. */
function доля(won: number, leads: number): number {
  return leads > 0 ? Math.round((won / leads) * 100) : 0;
}

// Доля выигранных от заявок. Ноль заявок — прочерк, а не «0%»: ноль из нуля
// не равен нулю, он не считается вовсе.
function процент(won: number, leads: number): string {
  if (!leads) return "—";
  return `${Math.round((won / leads) * 100)}%`;
}

/**
 * Предыдущий период той же длины, вплотную к заданному.
 *
 * `null`, если период не задан обеими границами: сравнивать «всё время»
 * не с чем, а сравнение с произвольным куском времени — не сравнение.
 */
function предыдущий(from: string, to: string): { from: string; to: string } | null {
  if (!from || !to) return null;

  const начало = new Date(from);
  const конец = new Date(to);
  if (Number.isNaN(начало.valueOf()) || Number.isNaN(конец.valueOf())) return null;

  const длина = конец.valueOf() - начало.valueOf();
  if (длина < 0) return null;

  const день = 86_400_000;
  const прошлыйКонец = new Date(начало.valueOf() - день);
  const прошлоеНачало = new Date(прошлыйКонец.valueOf() - длина);

  return { from: iso(прошлоеНачало), to: iso(прошлыйКонец) };
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
