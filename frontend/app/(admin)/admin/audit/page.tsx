"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { audit, staff as loadStaff, type AuditEntry, type Page, type StaffMember } from "@/lib/admin";
import { Avatar } from "../Avatar";
import {
  AUDIT_ACTION,
  AUDIT_ROBOT,
  AUDIT_SUBJECT,
  AUDIT_TONE,
  label,
} from "../labels";
import { Empty, Note, useLoad, when } from "../ui";

// Журнал.
//
// Читают его двумя разными способами, и это не одно и то же чтение.
// Сотрудник смотрит «что вчера происходило» — ему нужна фраза. Тот, кто
// разбирает случай, ищет по коду события — ему нужен `product.unpublish`.
// Поэтому в строке стоит и то, и другое: фраза крупно, код мелко под ней.
//
// Раньше фразы не было вовсе — в колонке «Действие» стоял код в плашке,
// и раздел читался как выгрузка логов, а не как рабочий экран.
//
// ───────────────────────────────────────────────────────────────────────────
// Журнал только читается
//
// Двери на правку нет и быть не может: на уровне базы UPDATE и DELETE
// по `audit_entry` закрыты триггером, а настоящая защита — отзыв прав
// у роли приложения при развёртывании среды.

const ОБЪЕКТЫ = [
  "",
  "product",
  "news",
  "document",
  "lead",
  "client",
  "deal",
  "quote",
  "category",
  "conversation",
  "media",
];

// Журнал по одному человеку адресуем: `/admin/audit/?actor=irina`.
//
// Оттуда приходят с карточки сотрудника и из профиля: вопрос «что он
// делал» задают, глядя на человека, а не открывая журнал и вспоминая
// логин.
//
// Suspense обязателен: без границы useSearchParams уводит страницу
// в отрисовку на клиенте целиком, и сборка об этом предупреждает.
export default function AuditPage() {
  return (
    <Suspense fallback={<p className="muted">Загружаем…</p>}>
      <Journal />
    </Suspense>
  );
}

function Journal() {
  const asked = useSearchParams().get("actor") ?? "";
  const [subject, setSubject] = useState("");
  // Отбор из адреса — начальное значение: дальше выбор ведут чипы.
  const [actor, setActor] = useState(asked);
  const [page, setPage] = useState(0);

  const { data, error, loading } = useLoad<Page<AuditEntry>>(
    () => audit({ subject, actor }, page),
    `${subject}:${actor}:${page}`,
  );
  const { data: people } = useLoad<StaffMember[]>(loadStaff);

  // Люди в фильтре — из справочника, а не из того, что попалось на странице:
  // на второй странице набор исполнителей другой, и фильтр прыгал бы.
  const кто = useMemo(() => people ?? [], [people]);

  return (
    <>
      <div className="admin-head">
        <h1>Журнал</h1>
      </div>

      <p className="admin-hint">
        Каждое действие в портале оставляет здесь запись. Персональных данных в журнале нет:
        пишутся идентификаторы, а не имена и адреса — иначе система логов сама становится
        хранилищем персональных данных.
      </p>

      <div className="chips">
        <span className="chips__label mono">Что</span>
        {ОБЪЕКТЫ.map((s) => (
          <span key={s || "all"} className={`chip${subject === s ? " chip--on" : ""}`}>
            <button
              type="button"
              className="chip__pick"
              aria-pressed={subject === s}
              onClick={() => {
                setSubject(s);
                setPage(0);
              }}
            >
              {s ? label(AUDIT_SUBJECT, s) : "Все"}
            </button>
          </span>
        ))}
      </div>

      <div className="chips">
        <span className="chips__label mono">Кто</span>
        <span className={`chip${actor === "" ? " chip--on" : ""}`}>
          <button
            type="button"
            className="chip__pick"
            aria-pressed={actor === ""}
            onClick={() => {
              setActor("");
              setPage(0);
            }}
          >
            Все
          </button>
        </span>

        {кто.map((p) => (
          <span key={p.login} className={`chip${actor === p.login ? " chip--on" : ""}`}>
            <button
              type="button"
              className="chip__pick"
              aria-pressed={actor === p.login}
              onClick={() => {
                setActor(p.login);
                setPage(0);
              }}
            >
              <Avatar name={p.name || p.login} size="s" />
              {p.name || p.login}
            </button>
          </span>
        ))}

        {/* Портал и посетитель — не сотрудники, и в справочнике их нет.
            Искать по ним надо не реже: отказ в доступе к закрытому файлу
            записан на «public». */}
        {["portal", "public"].map((робот) => (
          <span key={робот} className={`chip${actor === робот ? " chip--on" : ""}`}>
            <button
              type="button"
              className="chip__pick"
              aria-pressed={actor === робот}
              onClick={() => {
                setActor(робот);
                setPage(0);
              }}
            >
              <Avatar name={AUDIT_ROBOT[робот].name} size="s" tone="machine" />
              {AUDIT_ROBOT[робот].name}
            </button>
          </span>
        ))}
      </div>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}
      {data?.items.length === 0 && <Empty>По этому отбору записей нет.</Empty>}

      {data && data.items.length > 0 && (
        <>
          <div className="admin-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Кто</th>
                  <th>Что сделал</th>
                  <th>Над чем</th>
                  <th>Откуда</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => {
                  const тон = AUDIT_TONE[row.action];
                  return (
                    <tr key={row.id} className={тон === "danger" ? "row--stop" : ""}>
                      <td className="tight mono">{when(row.at)}</td>

                      <td className="tight">
                        <Who login={row.actor} people={кто} />
                      </td>

                      <td>
                        <span className={`did${тон ? ` did--${тон}` : ""}`}>
                          {label(AUDIT_ACTION, row.action)}
                        </span>
                        {/* Код мелко под фразой: он нужен, когда разбирают
                            случай, а не когда читают, что происходило. */}
                        <span className={`code${тон === "danger" ? " code--stop" : ""}`}>
                          {row.action}
                        </span>
                      </td>

                      <td className="tight">
                        <span className="row__under">{label(AUDIT_SUBJECT, row.subject)}</span>
                        {row.subjectId && (
                          <span className="row__under mono">{row.subjectId.slice(0, 8)}</span>
                        )}
                      </td>

                      <td className="tight mono">
                        {row.ip ?? <span className="nobody">не записан</span>}
                      </td>
                    </tr>
                  );
                })}
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

          <div className="legend">
            <div className="legend__one">
              <p className="legend__title">Что помечено красным</p>
              <p className="legend__body">
                То, чего не вернуть, и то, что означает попытку добраться до закрытого:
                уничтожение персональных данных, удаление черновика, отказ в доступе
                к закрытому файлу. Эти строки ищут первыми, когда разбирают случай.
              </p>
            </div>
            <div className="legend__one">
              <p className="legend__title">Что сделано без человека</p>
              <p className="legend__body">
                Записи на «Портал» и «Посетитель сайта» оставил не сотрудник: приём заявки
                формой, вопрос Ведалине, скачивание файла с сайта, отказ в доступе. Искать
                такого в справочнике сотрудников бесполезно — его там нет.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/**
 * Кто оставил запись.
 *
 * Логин сопоставляется со справочником: в журнале лежит `i.koltsova`,
 * а человек ищет глазами «Ирину». Не нашлось — показывается логин как есть,
 * и это не поломка: уволенный сотрудник из справочника уходит, а его записи
 * в журнале остаются навсегда.
 */
function Who({ login, people }: { login: string; people: readonly StaffMember[] }) {
  const робот = AUDIT_ROBOT[login];
  if (робот) {
    return (
      <span className="who">
        <Avatar name={робот.name} size="s" tone="machine" />
        <span className="who__body">
          <span className="who__name">{робот.name}</span>
          <span className="who__login mono">не сотрудник</span>
        </span>
      </span>
    );
  }

  const человек = people.find((p) => p.login === login);
  return (
    <span className="who">
      <Avatar name={человек?.name || login} size="s" />
      <span className="who__body">
        <span className="who__name">{человек?.name || login}</span>
        <span className="who__login mono">
          {человек ? login : "нет в справочнике"}
        </span>
      </span>
    </span>
  );
}
