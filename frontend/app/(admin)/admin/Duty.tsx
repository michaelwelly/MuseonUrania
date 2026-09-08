"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  dutyToday,
  handOffDuty,
  staff as loadStaff,
  type DutyToday,
  type StaffMember,
} from "@/lib/admin";
import { message, useLoad } from "./ui";

// Плашка дежурства над списком разговоров.
//
// ───────────────────────────────────────────────────────────────────────────
// Что здесь было раньше
//
// «Дежурство — ожидает уточнения: портал не хранит, кто сегодня на линии».
// Надпись была честной: имени в портале не было, и выдумать его нельзя —
// по нему передают разговоры. Теперь график есть, и на месте признания
// стоит имя (GitHub issue #51).
//
// ───────────────────────────────────────────────────────────────────────────
// Почему присутствие показывается рядом, а не вместо
//
// Дежурство говорит, кто ДОЛЖЕН быть на линии; присутствие — кто на ней
// ЕСТЬ. Показать одно вместо другого значит соврать в обе стороны: «Фёдорова
// дежурит» при закрытой вкладке читается как «она отвечает», а «на связи»
// без имени не отвечает на вопрос, с кого спрашивать.
//
// Расхождение — назначенный дежурный, который в рабочее время не открыл
// рабочее место, — считает портал, а не этот файл. Здесь оно только
// показывается: то же расхождение понадобится письмом, когда будет решено,
// кому его слать, и считаться оно должно один раз и в одном месте.
//
// ───────────────────────────────────────────────────────────────────────────
// Чего здесь нет
//
// Назначения на день. Плашка — про сегодня; график заполняют на экране
// «Дежурство», и дублировать его в шапке чужого раздела значит завести
// второе место, где меняется одно и то же.

/** Раз в минуту: «дежурный на месте» — состояние, которое меняется молча. */
const REFRESH_MS = 60_000;

export default function Duty() {
  const [beat, setBeat] = useState(0);
  const { data, error, setError } = useLoad<DutyToday>(dutyToday, String(beat));
  const [передаю, setПередаю] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setBeat((b) => b + 1), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  // Пока не ответили — плашки нет вовсе. Пустая рамка с прочерком на месте
  // имени читается как «дежурного нет», а это другое утверждение.
  if (!data) {
    return error ? (
      <p className="duty duty--wait">
        <span className="duty__label mono">Дежурство</span>
        <span className="duty__why">{error}</span>
      </p>
    ) : null;
  }

  const никого = !data.login;

  return (
    <div className={`duty${никого ? " duty--wait" : data.alarm ? " duty--alarm" : ""}`}>
      <span className="duty__label mono">Дежурит сегодня</span>

      {никого ? (
        <>
          <span className="duty__wait">никто не назначен</span>
          <span className="duty__why">
            {data.staffOnline
              ? "на связи кто-то есть, но спрашивать за неотвеченное не с кого"
              : "передавать смену некому"}
          </span>
        </>
      ) : (
        <>
          <span className="duty__who">{data.name ?? data.login}</span>
          <span className={`duty__at${data.atDesk ? " duty__at--on" : ""}`}>
            {data.atDesk ? "на месте" : "рабочее место не открыто"}
          </span>
          {data.note && <span className="duty__note">{data.note}</span>}
          {data.alarm && (
            <span className="duty__why">
              рабочее время идёт ({data.supportHours}), а дежурного на месте нет
            </span>
          )}
        </>
      )}

      <span className="duty__acts">
        {/* Пока форма открыта, кнопка, которая её открывает, убирается:
            две кнопки «Передать» на одном экране одинаковы и на слух,
            и под курсором. */}
        {!никого && !передаю && (
          <button type="button" className="btn btn--small" onClick={() => setПередаю(true)}>
            Передать смену
          </button>
        )}
        <Link href="/admin/duty/">График</Link>
      </span>

      {передаю && (
        <HandOff
          сейчас={data.login}
          готово={() => {
            setПередаю(false);
            setBeat((b) => b + 1);
          }}
          отмена={() => setПередаю(false)}
          наОшибку={setError}
        />
      )}
    </div>
  );
}

/**
 * Передача смены.
 *
 * Выбор из справочника, а не свободная строка: логин, написанный руками,
 * ошибается молча — смена оказывается на человеке, которого нет, и это
 * ровно тот случай, когда по записи решают, кому звонить.
 */
function HandOff({
  сейчас,
  готово,
  отмена,
  наОшибку,
}: {
  сейчас: string | null;
  готово: () => void;
  отмена: () => void;
  наОшибку: (текст: string | null) => void;
}) {
  const { data } = useLoad<StaffMember[]>(loadStaff);
  const [кому, setКому] = useState("");
  const [записка, setЗаписка] = useState("");
  const [идёт, setИдёт] = useState(false);

  // Себе смену не передают, а отключённый её не примет: портал откажет
  // и в том, и в другом. Показывать строку, которая приведёт к отказу,
  // значит соврать дважды — сначала предложив, потом отказав.
  const люди = (data ?? []).filter((p) => p.enabled && p.login !== сейчас);

  async function передать() {
    if (!кому) return;
    setИдёт(true);
    наОшибку(null);
    try {
      await handOffDuty(кому, записка || undefined);
      готово();
    } catch (e) {
      наОшибку(message(e));
    } finally {
      setИдёт(false);
    }
  }

  return (
    <form
      className="duty__form"
      onSubmit={(e) => {
        e.preventDefault();
        void передать();
      }}
    >
      <label className="duty__pick">
        <span className="duty__picklabel">Кому передать смену</span>
        <select value={кому} onChange={(e) => setКому(e.target.value)}>
          <option value="">— выберите —</option>
          {люди.map((p) => (
            <option key={p.login} value={p.login}>
              {p.name && p.name.trim() ? p.name : p.login}
            </option>
          ))}
        </select>
      </label>

      {/* Подсказка внутри поля исчезает на первом же знаке, и человек,
          вернувшийся к форме, видит текст без имени. Имя — отдельно. */}
      <input
        type="text"
        aria-label="Записка к смене"
        maxLength={500}
        placeholder="Записка к смене (необязательно)"
        value={записка}
        onChange={(e) => setЗаписка(e.target.value)}
      />

      <button type="submit" className="btn" disabled={!кому || идёт}>
        {идёт ? "Передаём…" : "Передать"}
      </button>
      <button type="button" className="btn btn--small" onClick={отмена}>
        Отмена
      </button>
    </form>
  );
}
