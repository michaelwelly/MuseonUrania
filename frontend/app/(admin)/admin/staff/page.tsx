"use client";

import Link from "next/link";
import { leads, staff as loadStaff, type LeadRow, type Page, type StaffMember } from "@/lib/admin";
import { plural } from "@/lib/plural";
import { Avatar } from "../Avatar";
import { Empty, Note, useLoad } from "../ui";
import { useWho } from "../who";

// Сотрудники.
//
// Список приходит из провайдера идентичности (`staff()`), и он только
// читается: завести человека и выдать роль — работа консоли Keycloak.
// Кнопки «Добавить сотрудника» здесь нет и не будет; вместо неё сказано,
// где это делается.
//
// ───────────────────────────────────────────────────────────────────────────
// Чего портал о человеке не знает
//
// `StaffMember` несёт логин, имя и признак «учётная запись включена».
// Больше ничего: ни должности, ни ролей, ни присутствия. В макете всё это
// на карточке — и выдумать его нельзя: по должности решают, кому передать
// разговор, а по присутствию — ждать ответа или звонить.
//
// Поэтому на месте каждого стоит «ожидает уточнения», а не правдоподобное
// значение. Появится в провайдере — появится и здесь.
//
// ───────────────────────────────────────────────────────────────────────────
// Что портал знает по-настоящему
//
// Сколько заявок числится за человеком. Это единственное число нагрузки,
// которое можно спросить: у заявок есть отбор по ответственному, у сделок
// и разговоров такого отбора нет. Показывать два выдуманных числа рядом
// с одним настоящим — значит обесценить настоящее.

export default function StaffPage() {
  const who = useWho();
  const { data, error, loading } = useLoad<StaffMember[]>(loadStaff);

  return (
    <>
      <div className="admin-head">
        <h1>Сотрудники</h1>
      </div>

      <p className="admin-hint">
        Список приходит из системы входа компании и только читается. Завести человека,
        выдать роль и отключить учётную запись — работа консоли Keycloak: портал этого
        не умеет намеренно, иначе право заводить сотрудников оказалось бы у всех, кто
        может править каталог.
      </p>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}
      {data?.length === 0 && <Empty>В справочнике никого нет.</Empty>}

      {data && data.length > 0 && (
        <div className="people">
          {data.map((p) => (
            <Card key={p.login} person={p} me={p.login === who.actor} />
          ))}
        </div>
      )}
    </>
  );
}

function Card({ person, me }: { person: StaffMember; me: boolean }) {
  const имя = person.name?.trim() || person.login;

  // Заявки этого человека — настоящим числом, отдельным запросом на карточку.
  // Пять карточек — пять запросов по одной строке: `total` без самой страницы.
  const { data: заявки } = useLoad<Page<LeadRow>>(
    () => leads({ owner: person.login }, 0, 1),
    person.login,
  );

  return (
    <article
      className={[
        "person",
        me ? "person--me" : "",
        person.enabled ? "" : "person--off",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="person__top">
        <Avatar
          name={имя}
          size="l"
          presence={person.enabled ? "unknown" : "off"}
          tone={person.enabled ? "person" : "machine"}
        />

        <div className="person__who">
          <p className="person__name">
            {имя}
            {me && <span className="person__me mono">это вы</span>}
          </p>
          <p className="person__role nobody">должность ожидает уточнения</p>
          <p className="person__login mono">{person.login}</p>
        </div>

        <span className={`badge ${person.enabled ? "badge--on" : "badge--off"}`}>
          {person.enabled ? "работает" : "отключён"}
        </span>
      </div>

      <div className="person__load">
        <Link className="load" href={`/admin/leads/?owner=${encodeURIComponent(person.login)}`}>
          <span className="load__num mono">{заявки ? заявки.total : "…"}</span>
          <span className="load__what">
            {заявки ? plural(заявки.total, "заявка", "заявки", "заявок") : "заявок"}
          </span>
        </Link>

        {/* Два пустых места, а не два выдуманных числа: у сделок и разговоров
            отбора по ответственному у портала нет, и посчитать их нечем. */}
        <span className="load load--none">
          <span className="load__num nobody">—</span>
          <span className="load__what">сделки: нет отбора</span>
        </span>
        <span className="load load--none">
          <span className="load__num nobody">—</span>
          <span className="load__what">разговоры: нет отбора</span>
        </span>
      </div>

      <div className="person__go">
        <Link className="btn btn--small" href={`/admin/audit/?actor=${encodeURIComponent(person.login)}`}>
          Что делал в журнале
        </Link>
      </div>

      {!person.enabled && (
        <p className="person__note">
          Учётная запись отключена, но человек остаётся в списке: на нём висят старые
          заявки и сделки, и убрать его значит показать их без ответственного.
        </p>
      )}
    </article>
  );
}
