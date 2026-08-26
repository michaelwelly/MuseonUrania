"use client";

import Link from "next/link";
import {
  chatsAll,
  deals,
  leads,
  staff as loadStaff,
  type ChatCard,
  type DealRow,
  type LeadRow,
  type Page,
  type StaffMember,
} from "@/lib/admin";
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
// Сколько заявок, сделок и разговоров числится за человеком. Раньше здесь
// было одно число и два прочерка: отбор по ответственному был только
// у заявок. Теперь он есть у всех трёх дверей, и все три числа настоящие.
//
// Три запроса на карточку вместо одного — по строке из каждого списка,
// ради `total`. Сотрудников десятки, а не тысячи; когда их станет столько,
// что это заметно, считать нагрузку будет отдельная дверь, а не карточка.

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

  // Нагрузка — настоящими числами, по запросу на список. Просится одна
  // строка ради `total`: сама страница здесь не нужна.
  const { data: заявки } = useLoad<Page<LeadRow>>(
    () => leads({ owner: person.login }, 0, 1),
    person.login,
  );
  const { data: сделки } = useLoad<Page<DealRow>>(
    () => deals({ owner: person.login }, 0, 1),
    person.login,
  );
  const { data: разговоры } = useLoad<Page<ChatCard>>(
    () => chatsAll(person.login, 0, 1),
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

          {/* Роли рядом с логином, а не отдельной колонкой: вопрос
              «кто у нас продажи» задают о человеке, а не о таблице.
              Раньше ответ на него жил только в консоли Keycloak. */}
          <p className="person__roles">
            {person.roles.length === 0 ? (
              <span className="nobody">в портал не пущен</span>
            ) : (
              person.roles.map((r) => (
                <span key={r} className="role mono">
                  {r}
                </span>
              ))
            )}
          </p>
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

        <Link className="load" href={`/admin/deals/?owner=${encodeURIComponent(person.login)}`}>
          <span className="load__num mono">{сделки ? сделки.total : "…"}</span>
          <span className="load__what">
            {сделки ? plural(сделки.total, "сделка", "сделки", "сделок") : "сделок"}
          </span>
        </Link>

        <Link className="load" href={`/admin/chats/?owner=${encodeURIComponent(person.login)}`}>
          <span className="load__num mono">{разговоры ? разговоры.total : "…"}</span>
          <span className="load__what">
            {разговоры ? plural(разговоры.total, "разговор", "разговора", "разговоров") : "разговоров"}
          </span>
        </Link>
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
