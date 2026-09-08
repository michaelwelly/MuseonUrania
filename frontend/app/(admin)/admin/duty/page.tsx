"use client";

import { useMemo, useState } from "react";
import {
  assignDuty,
  duty as loadDuty,
  releaseDuty,
  staff as loadStaff,
  type DutyShift,
  type StaffMember,
} from "@/lib/admin";
import { Empty, Note, day, message, useLoad, when } from "../ui";

// Дежурство: кто на линии сегодня и кто будет дальше.
//
// ───────────────────────────────────────────────────────────────────────────
// Зачем этот экран
//
// Портал знал две вещи и ни одна не называла человека. Часы работы поддержки
// обещают, что кто-то ответит; присутствие говорит, открыто ли хоть одно
// рабочее место. Передать смену было некому, и за неотвеченный вопрос
// спрашивать было не с кого (GitHub issue #51).
//
// ───────────────────────────────────────────────────────────────────────────
// Почему две недели, а не месяц
//
// Это горизонт, на котором о дежурстве договариваются. Дальше меняются
// отпуска и командировки, и график, заполненный на месяц, к третьей неделе
// врёт — а по нему решают, кому звонить.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему пустые дни рисуются здесь, а не приходят из портала
//
// Строка «дежурного нет» в базе неотличима от строки, которую забыли
// удалить. Портал отдаёт только заполненные дни; календарь без дыр —
// это про показ, и собирается он там, где показывают.
//
// ───────────────────────────────────────────────────────────────────────────
// Чего здесь нет
//
// Правки прошедших дней. График вперёд — договорённость, график назад —
// переписывание истории: смена, «назначенная» вчера, отвечает на вопрос
// «кто дежурил» не тем, кто дежурил. Портал такую правку отвергает,
// а здесь мы не показываем кнопку, которая привела бы к отказу.
//
// Повторов «каждый вторник». Правило дежурства — это ещё и вопрос, что
// делать с праздниками и отпусками, и заводить его до того, как график
// хоть раз заполнили руками, значит угадывать.

/** Сколько дней показывать. То же число знает портал — оно у него по умолчанию. */
const ДНЕЙ = 14;

const НЕДЕЛЯ = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export default function DutyPage() {
  const [beat, setBeat] = useState(0);
  const { data, error, loading, setError } = useLoad<DutyShift[]>(
    () => loadDuty(),
    String(beat),
  );
  const { data: people } = useLoad<StaffMember[]>(loadStaff);

  // Сегодня по часам браузера. Портал считает свой день по зоне поддержки,
  // и разойтись они могут на час в сутки: у дежурного, сидящего в другом
  // поясе, «сегодня» наступает раньше. Ошибка здесь стоит подсветки
  // не той строки, а не неверной записи — записывает всё равно портал,
  // и день он берёт свой.
  const дни = useMemo(() => {
    const первый = new Date();
    return Array.from({ length: ДНЕЙ }, (_, i) => {
      const d = new Date(первый);
      d.setDate(d.getDate() + i);
      return iso(d);
    });
  }, []);

  const назначенные = useMemo(() => {
    const map = new Map<string, DutyShift>();
    (data ?? []).forEach((shift) => map.set(shift.date, shift));
    return map;
  }, [data]);

  async function поставить(date: string, login: string) {
    setError(null);
    try {
      if (login) await assignDuty(date, login);
      else await releaseDuty(date);
      setBeat((b) => b + 1);
    } catch (e) {
      setError(message(e));
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Дежурство</h1>
      </div>

      <p className="admin-hint">
        Кто на линии в этот день. Часы работы поддержки задаются настройками портала
        и здесь не меняются: график отвечает не на вопрос «когда отвечают»,
        а на вопрос «кто сегодня отвечает». Прошедшие дни не правятся.
      </p>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}

      {data && дни.length === 0 && <Empty>Показывать нечего.</Empty>}

      <table className="rota">
        <caption className="visually-hidden">
          График дежурств на ближайшие две недели
        </caption>
        <thead>
          <tr>
            <th scope="col">День</th>
            <th scope="col">Дежурный</th>
            <th scope="col">Записка</th>
            <th scope="col">Кто поставил</th>
          </tr>
        </thead>
        <tbody>
          {дни.map((date, i) => {
            const shift = назначенные.get(date) ?? null;
            const сегодня = i === 0;
            return (
              <tr key={date} className={сегодня ? "rota__today" : undefined}>
                <th scope="row">
                  <span className="rota__day mono">{day(date)}</span>
                  <span className="rota__dow">{НЕДЕЛЯ[new Date(date).getDay()]}</span>
                  {сегодня && <span className="rota__mark">сегодня</span>}
                </th>

                <td>
                  <label>
                    <span className="visually-hidden">Дежурный на {day(date)}</span>
                    <select
                      value={shift?.login ?? ""}
                      onChange={(e) => void поставить(date, e.target.value)}
                    >
                      <option value="">— никто</option>

                      {/* Логин, которого нет в справочнике, — первой строкой:
                          иначе выбранное значение выглядело бы как «никто»,
                          и первое же сохранение стёрло бы его молча. */}
                      {shift && !(people ?? []).some((p) => p.login === shift.login) && (
                        <option value={shift.login}>{shift.login} — нет в справочнике</option>
                      )}

                      {(people ?? [])
                        .filter((p) => p.enabled)
                        .map((p) => (
                          <option key={p.login} value={p.login}>
                            {p.name && p.name.trim() ? p.name : p.login}
                          </option>
                        ))}
                    </select>
                  </label>

                  {сегодня && shift && (
                    <span className={`duty__at${shift.atDesk ? " duty__at--on" : ""}`}>
                      {shift.atDesk ? "на месте" : "рабочее место не открыто"}
                    </span>
                  )}
                </td>

                <td className="rota__note">{shift?.note ?? <span className="nobody">—</span>}</td>

                <td className="rota__by">
                  {shift ? (
                    <>
                      <span className="mono">{shift.assignedBy}</span>
                      <span className="rota__at">{when(shift.assignedAt)}</span>
                    </>
                  ) : (
                    <span className="nobody">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

/** `YYYY-MM-DD` по местному времени: toISOString сдвинул бы дату на UTC. */
function iso(date: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}
