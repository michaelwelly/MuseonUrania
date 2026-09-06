"use client";

import Link from "next/link";
import { useState } from "react";
import {
  assignRoles,
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
import { may } from "../roles";
import { Empty, Note, useLoad } from "../ui";
import { useWho } from "../who";
import { PORTAL_ROLES } from "../roles";

// Сотрудники.
//
// Список приходит из провайдера идентичности (`staff()`). Завести человека,
// отключить его и сменить пароль — по-прежнему консоль Keycloak; кнопки
// «Добавить сотрудника» здесь нет и не будет.
//
// Меняется ровно одно: набор ПОРТАЛЬНЫХ ролей. Раньше и это жило только
// в консоли, и вопрос «почему Петров не видит заявок» решался походом
// в другую систему.
//
// Редактор показывается только администратору и только на чужой карточке.
// Своя заперта не интерфейсом, а порталом: он отказывает на любую попытку
// сменить роли себе — иначе достаточно один раз дорваться до двери, чтобы
// подняться до администратора. Здесь мы лишь не показываем кнопку,
// которая привела бы к отказу.
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
  const { data, error, loading, reload, setError } = useLoad<StaffMember[]>(loadStaff);
  const правлю = may(who, "admin");

  return (
    <>
      <div className="admin-head">
        <h1>Сотрудники</h1>
      </div>

      <p className="admin-hint">
        Список приходит из системы входа компании. Завести человека, отключить учётную
        запись и сменить пароль — работа консоли Keycloak. Здесь меняются только
        портальные роли: ими решается, что сотрудник видит в админке.
        {правлю && " Свои роли через портал не меняются — попросите другого администратора."}
      </p>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}
      {data?.length === 0 && <Empty>В справочнике никого нет.</Empty>}

      {data && data.length > 0 && (
        <div className="people">
          {data.map((p) => (
            <Card
              key={p.login}
              person={p}
              me={p.login === who.actor}
              правлю={правлю}
              сохранено={reload}
              наОшибку={setError}
            />
          ))}
        </div>
      )}
    </>
  );
}

function Card({
  person,
  me,
  правлю,
  сохранено,
  наОшибку,
}: {
  person: StaffMember;
  me: boolean;
  правлю: boolean;
  сохранено: () => void;
  наОшибку: (текст: string | null) => void;
}) {
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
          {правлю && !me ? (
            <Roles person={person} сохранено={сохранено} наОшибку={наОшибку} />
          ) : (
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
          )}
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

/**
 * Роли одного человека: показ и правка.
 *
 * Правка НЕ мгновенная. Роль решает, что человек видит в закрытом контуре,
 * и случайное попадание по чипу не должно этого менять: набор сначала
 * складывается в черновике, кнопка появляется только когда он отличается
 * от сохранённого.
 *
 * Отправляется набор целиком — так же, как его принимает дверь. «Добавить
 * одну» и «снять одну» породили бы третье состояние: добавили, снять
 * забыли.
 */
function Roles({
  person,
  сохранено,
  наОшибку,
}: {
  person: StaffMember;
  сохранено: () => void;
  наОшибку: (текст: string | null) => void;
}) {
  const [черновик, setЧерновик] = useState<string[]>(person.roles);
  const [шлём, setШлём] = useState(false);

  // Сравнение по составу, а не по порядку: порядок задаёт портал,
  // и полагаться на него здесь значило бы показать кнопку там,
  // где ничего не изменилось.
  const изменилось =
    черновик.length !== person.roles.length ||
    черновик.some((r) => !person.roles.includes(r));

  const переключить = (роль: string) =>
    setЧерновик((было) =>
      было.includes(роль) ? было.filter((r) => r !== роль) : [...было, роль],
    );

  const сохранить = async () => {
    setШлём(true);
    наОшибку(null);
    try {
      await assignRoles(person.login, черновик);
      сохранено();
    } catch (e) {
      // Черновик НЕ сбрасывается: человек видит, что хотел сделать,
      // и может исправить или отменить. Сброс к сохранённому выглядел бы
      // так, будто нажатия не было.
      наОшибку(e instanceof Error ? e.message : "Не удалось выдать роли");
    } finally {
      setШлём(false);
    }
  };

  return (
    <div className="person__roles">
      {PORTAL_ROLES.map((роль) => {
        const выбрана = черновик.includes(роль);
        return (
          <button
            key={роль}
            type="button"
            className={`role role--pick mono${выбрана ? " role--on" : ""}`}
            aria-pressed={выбрана}
            disabled={шлём}
            onClick={() => переключить(роль)}
          >
            {роль}
          </button>
        );
      })}

      {черновик.length === 0 && (
        <span className="nobody">в портал не пущен</span>
      )}

      {изменилось && (
        <span className="person__save">
          <button
            type="button"
            className="btn btn--primary btn--small"
            disabled={шлём}
            onClick={() => void сохранить()}
          >
            {шлём ? "Сохраняем…" : "Сохранить"}
          </button>
          <button
            type="button"
            className="btn btn--small"
            disabled={шлём}
            onClick={() => setЧерновик(person.roles)}
          >
            Отменить
          </button>
        </span>
      )}
    </div>
  );
}
