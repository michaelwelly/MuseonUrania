"use client";

import Link from "next/link";
import {
  audit,
  leads,
  staff as loadStaff,
  type AuditEntry,
  type LeadRow,
  type Page,
  type StaffMember,
} from "@/lib/admin";
import { logout } from "@/lib/auth";
import { plural } from "@/lib/plural";
import { Avatar } from "../Avatar";
import { AUDIT_ACTION, AUDIT_TONE, label } from "../labels";
import { Note, useLoad, when } from "../ui";
import { may } from "../roles";
import { useWho } from "../who";

// Мой профиль.
//
// Отвечает на два вопроса: кто я для портала и что мне сейчас доступно.
// Правки здесь нет ни одной — учётная запись живёт в системе входа компании,
// и портал её только читает.
//
// ───────────────────────────────────────────────────────────────────────────
// Что можно — считается по ролям, а не нарисовано
//
// Раньше здесь стоял список из пяти пунктов, где четыре всегда «да».
// Тогда это было правдой: ролей было две, и обе портал пускал ко всему
// одним правилом. Теперь ролей три и делят они контуры — продажи
// и содержимое сайта, — поэтому прошитый список стал враньём: продавец
// читал у себя в профиле, что ему можно править каталог.
//
// Пункты считаются тем же `may`, что и разделы меню. Разойдись они,
// человек увидел бы в профиле одно, а в оболочке другое.
//
// ───────────────────────────────────────────────────────────────────────────
// Чего портал о вас не знает
//
// Почты, телефона, даты прихода в портал и времени прошлого входа. Всё это
// живёт в системе входа компании и в токен не приезжает. На их месте стоит
// «ожидает уточнения»: правдоподобная дата «в портале с 12 марта» — это
// выдумка, по которой однажды будут считать стаж.

export default function ProfilePage() {
  const who = useWho();
  const { data: people } = useLoad<StaffMember[]>(loadStaff);
  const я = people?.find((p) => p.login === who.actor);
  const имя = я?.name?.trim() || who.actor;

  // Профиль открыт любой роли, а эти две двери — нет: заявки лежат
  // в контуре продаж, журнал закрыт администратором.
  //
  // Что было. Обе дёргались всегда, у кого бы ни открыли страницу.
  // Продавец получал 403 на журнале и читал текст ошибки прямо на своём
  // профиле; у роли «содержимое сайта» вдобавок вечно крутилась плитка
  // заявок — запрос падал, данные не приходили, «…» оставалось навсегда.
  //
  // Отказ на двери, которую тебе не открывали, — не поломка, и показывать
  // его как поломку значит пугать человека тем, что работает правильно.
  // Не спрашиваем вовсе, а пустоту объясняем словами.
  const мойКонтурПродаж = may(who, "sales");
  const мнеВиденЖурнал = may(who, "admin");

  const { data: заявки } = useLoad<Page<LeadRow> | null>(
    () => (мойКонтурПродаж ? leads({ owner: who.actor }, 0, 1) : Promise.resolve(null)),
    `${who.actor}#${мойКонтурПродаж}`,
  );
  const { data: журнал, error } = useLoad<Page<AuditEntry> | null>(
    () => (мнеВиденЖурнал ? audit({ actor: who.actor }, 0, 8) : Promise.resolve(null)),
    `${who.actor}#${мнеВиденЖурнал}`,
  );

  return (
    <>
      <div className="admin-head">
        <div className="me">
          <Avatar name={имя} size="xl" presence="unknown" />
          <div className="me__who">
            <h1>{имя}</h1>
            <p className="me__role nobody">должность ожидает уточнения</p>
            <p className="me__login mono">{who.actor}</p>
          </div>
        </div>

        <div className="row">
          <button className="btn" onClick={() => logout()}>
            Выйти
          </button>
        </div>
      </div>

      <div className="board2">
        <section>
          <h2 className="admin-card__title">Учётная запись</h2>
          <div className="admin-card">
            <dl className="pairs">
              <Pair name="Логин" value={who.actor} mono />
              <Pair
                name="Роли"
                value={who.roles.length > 0 ? who.roles.join(" · ") : null}
                mono
                empty="портал не разобрал ни одной роли"
              />
              <Pair name="Способ входа" value={who.authentication} mono />
              <Pair
                name="Учётная запись"
                value={я ? (я.enabled ? "включена" : "отключена") : null}
                empty="нет в справочнике сотрудников"
              />
              <Pair name="Почта" value={null} />
              <Pair name="Телефон" value={null} />
              <Pair name="В портале с" value={null} />
              <Pair name="Последний вход" value={null} />
            </dl>

            <p className="admin-hint">
              Почта, телефон и даты живут в системе входа компании и в токен не приезжают.
              Портал показывает только то, что в токене есть; выдумать остальное значило бы
              однажды посчитать по выдуманной дате стаж.
            </p>
          </div>

          <h2 className="admin-card__title">Что можно с этими ролями</h2>
          <div className="admin-card">
            <ul className="check">
              <Can yes={may(who, "production")}>
                Править каталог, новости и документы, публиковать и снимать
              </Can>
              <Can yes={may(who, "sales")}>
                Вести заявки, клиентов, сделки и КП, отвечать в разговорах
              </Can>
              <Can yes={may(who, "admin")}>
                Уничтожать персональные данные по обращению субъекта
              </Can>
              <Can yes={may(who, "admin")}>Читать журнал целиком</Can>
              <Can>
                Заводить сотрудников и выдавать роли — это консоль системы входа, а не
                портал
              </Can>
            </ul>

            <p className="admin-hint">
              Ролей три. <code>portal-admin</code> открыт везде;{" "}
              <code>portal-sales</code> и <code>portal-production</code> делят не глубину
              доступа, а предмет работы — клиентов и содержимое сайта. Роль выдают
              в консоли системы входа, портал её только читает из токена.
            </p>
          </div>
        </section>

        <section>
          <h2 className="admin-card__title">Нагрузка сейчас</h2>
          <div className="tiles">
            {мойКонтурПродаж ? (
              <Link
                className="tile"
                href={`/admin/leads/?owner=${encodeURIComponent(who.actor)}`}
              >
                <div className="tile__num">{заявки ? заявки.total : "…"}</div>
                <div className="tile__label">
                  {заявки ? plural(заявки.total, "заявка", "заявки", "заявок") : "заявок"} на вас
                </div>
              </Link>
            ) : (
              <span className="tile tile--none">
                <div className="tile__num nobody">—</div>
                <div className="tile__label">заявки ведёт контур продаж — вашей роли он не открыт</div>
              </span>
            )}

            {/* Сделки и разговоры посчитать нечем: отбора по ответственному
                у этих дверей нет. Пустая плитка честнее правдоподобной. */}
            <span className="tile tile--none">
              <div className="tile__num nobody">—</div>
              <div className="tile__label">сделки: у портала нет отбора по ответственному</div>
            </span>
            <span className="tile tile--none">
              <div className="tile__num nobody">—</div>
              <div className="tile__label">разговоры: у портала нет отбора по ответственному</div>
            </span>
          </div>

          <h2 className="admin-card__title">Последние действия в журнале</h2>

          {!мнеВиденЖурнал && (
            <p className="admin-hint">
              Журнал открыт администратору. Он показывает, кто что делал, — включая тех,
              кто в него смотрит, — и для работы контура не нужен.
            </p>
          )}

          {мнеВиденЖурнал && <Note kind="error">{error}</Note>}

          {журнал && журнал.items.length === 0 && (
            <p className="admin-hint">Записей за вами пока нет.</p>
          )}

          {журнал && журнал.items.length > 0 && (
            <div className="recent">
              {журнал.items.map((row) => (
                <span key={row.id} className="recent__row">
                  <span className="recent__when mono">{when(row.at)}</span>
                  <span
                    className={`recent__what${
                      AUDIT_TONE[row.action] === "danger" ? " did--danger" : ""
                    }`}
                  >
                    {label(AUDIT_ACTION, row.action)}
                  </span>
                </span>
              ))}
            </div>
          )}

          {мнеВиденЖурнал && (
            <p className="admin-hint">
              <Link href={`/admin/audit/?actor=${encodeURIComponent(who.actor)}`}>
                Весь журнал по вам →
              </Link>
            </p>
          )}
        </section>
      </div>
    </>
  );
}

/** Пара «ключ — значение». Незаполненное названо словами, а не прочерком. */
function Pair({
  name,
  value,
  mono,
  empty = "ожидает уточнения",
}: {
  name: string;
  value: string | null;
  mono?: boolean;
  empty?: string;
}) {
  return (
    <div className="pairs__row">
      <dt>{name}</dt>
      <dd className={value ? (mono ? "mono" : undefined) : "nobody"}>{value ?? empty}</dd>
    </div>
  );
}

/** Строка «что можно»: галочка у доступного, прочерк у того, что не здесь. */
function Can({ yes, children }: { yes?: boolean; children: React.ReactNode }) {
  return (
    <li className={`check__row${yes ? " check__row--on" : ""}`}>
      <span className="check__mark" aria-hidden="true">
        {yes ? "✓" : "—"}
      </span>
      <span className="check__body">
        <span className="check__what">{children}</span>
      </span>
    </li>
  );
}
