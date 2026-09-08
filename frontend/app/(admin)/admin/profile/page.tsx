"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  audit,
  chatsAll,
  deals,
  leads,
  removeMyAvatar,
  staff as loadStaff,
  uploadMyAvatar,
  AVATAR_MAX_BYTES,
  type AuditEntry,
  type ChatCard,
  type DealRow,
  type LeadRow,
  type Page,
  type StaffMember,
} from "@/lib/admin";
import { logout } from "@/lib/auth";
import { plural } from "@/lib/plural";
import { Avatar } from "../Avatar";
import { AUDIT_ACTION, AUDIT_TONE, label } from "../labels";
import { forgetPortrait, usePortrait } from "../portraits";
import { message, Note, useLoad, when } from "../ui";
import { may } from "../roles";
import { useWho } from "../who";

// Мой профиль.
//
// Отвечает на два вопроса: кто я для портала и что мне сейчас доступно.
//
// ───────────────────────────────────────────────────────────────────────────
// Правка здесь ровно одна — портрет
//
// Раньше здесь стояло «правки нет ни одной»: учётная запись живёт в системе
// входа компании, и портал её только читает. Про логин, имя, роли и почту
// это по-прежнему верно и меняться не должно — второй список сотрудников
// разошёлся бы с Keycloak на первом же увольнении.
//
// Портрет — исключение, и оно не размывает правило, а очерчивает его:
// портрета в токене НЕТ. Keycloak умеет хранить его в атрибуте
// пользователя, но менять свой атрибут может только тот, кому выдали право
// менять пользователей, — то есть право менять кого угодно. Поэтому портрет
// хранит портал, и это единственное поле профиля, у которого хозяин — сам
// сотрудник (issue #93).
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
  // Размер страницы 1: нужно `total`, а не сами записи. Ровно так же
  // считает нагрузку раздел «Сотрудники» — второй способ считать одно
  // и то же однажды разошёлся бы с первым.
  const { data: сделки } = useLoad<Page<DealRow> | null>(
    () => (мойКонтурПродаж ? deals({ owner: who.actor }, 0, 1) : Promise.resolve(null)),
    `${who.actor}#сделки#${мойКонтурПродаж}`,
  );
  const { data: разговоры } = useLoad<Page<ChatCard> | null>(
    () => (мойКонтурПродаж ? chatsAll(who.actor, 0, 1) : Promise.resolve(null)),
    `${who.actor}#разговоры#${мойКонтурПродаж}`,
  );
  const { data: журнал, error } = useLoad<Page<AuditEntry> | null>(
    () => (мнеВиденЖурнал ? audit({ actor: who.actor }, 0, 8) : Promise.resolve(null)),
    `${who.actor}#${мнеВиденЖурнал}`,
  );

  return (
    <>
      <div className="admin-head">
        <div className="me">
          <Avatar name={имя} login={who.actor} size="xl" presence="unknown" />
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
          <h2 className="admin-card__title">Портрет</h2>
          <Portrait login={who.actor} />

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
              {/* Раньше здесь стоял безусловный прочерк: «выдавать роли —
                  это консоль системы входа, а не портал». С 26 августа
                  это неправда — портал раздаёт ПОРТАЛЬНЫЕ роли сам,
                  раздел «Сотрудники». Строка осталась от прежнего решения
                  и отправляла администратора искать консоль Keycloak
                  вместо соседнего раздела (issue #98).

                  Граница, которая при этом никуда не делась, названа
                  словами ниже: завести человека, отключить его и сменить
                  пароль — по-прежнему консоль. Портал меняет НАБОР
                  портальных ролей и ничего больше. */}
              <Can yes={may(who, "admin")}>
                Выдавать и снимать портальные роли в разделе «Сотрудники»
              </Can>
            </ul>

            <p className="admin-hint">
              Ролей три. <code>portal-admin</code> открыт везде;{" "}
              <code>portal-sales</code> и <code>portal-production</code> делят не глубину
              доступа, а предмет работы — клиентов и содержимое сайта. Сами роли
              администратор выдаёт в разделе{" "}
              <Link href="/admin/staff/">«Сотрудники»</Link>; завести человека,
              отключить учётную запись и сменить пароль — работа консоли системы
              входа, и портал за неё не берётся.
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

            {/* Здесь долго стоял прочерк с подписью «у портала нет отбора
                по ответственному». Отбор есть — `/deals?owner=` и
                `/chats?owner=`, — и раздел «Сотрудники» им уже пользуется:
                про каждого ДРУГОГО человека нагрузка считалась, а про
                того, кто открыл свой кабинет, — «нечем» (issue #97).

                Подпись при этом не просто пустовала, она утверждала про
                портал неправду, и прочитавший её дальше не искал. */}
            {мойКонтурПродаж ? (
              <>
                <Link
                  className="tile"
                  href={`/admin/deals/?owner=${encodeURIComponent(who.actor)}`}
                >
                  <div className="tile__num">{сделки ? сделки.total : "…"}</div>
                  <div className="tile__label">
                    {сделки ? plural(сделки.total, "сделка", "сделки", "сделок") : "сделок"} на вас
                  </div>
                </Link>
                <Link
                  className="tile"
                  href={`/admin/chats/?owner=${encodeURIComponent(who.actor)}`}
                >
                  <div className="tile__num">{разговоры ? разговоры.total : "…"}</div>
                  <div className="tile__label">
                    {разговоры
                      ? plural(разговоры.total, "разговор", "разговора", "разговоров")
                      : "разговоров"}{" "}
                    на вас
                  </div>
                </Link>
              </>
            ) : (
              <>
                <span className="tile tile--none">
                  <div className="tile__num nobody">—</div>
                  <div className="tile__label">
                    сделки ведёт контур продаж — вашей роли он не открыт
                  </div>
                </span>
                <span className="tile tile--none">
                  <div className="tile__num nobody">—</div>
                  <div className="tile__label">
                    разговоры ведёт контур продаж — вашей роли он не открыт
                  </div>
                </span>
              </>
            )}
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

/**
 * Свой портрет: поставить, заменить, убрать.
 *
 * Кнопка «убрать» появляется только когда портрет есть. Не ради чистоты
 * экрана: кнопка, которая ничего не делает, читается как сломанная —
 * человек жмёт её, ничего не происходит, и он жмёт ещё раз.
 *
 * Предел размера проверяется и здесь, и на портале. Здесь — чтобы не гнать
 * впустую файл, который всё равно отвергнут; настоящая проверка там, вместе
 * с проверкой содержимого, которую браузеру доверить нельзя.
 */
function Portrait({ login }: { login: string }) {
  const портрет = usePortrait(login);
  const [занято, занять] = useState(false);
  const [ошибка, сказать] = useState<string | null>(null);
  const поле = useRef<HTMLInputElement>(null);

  async function загрузить(file: File) {
    if (file.size > AVATAR_MAX_BYTES) {
      сказать(
        `Файл больше ${AVATAR_MAX_BYTES / 1024 / 1024} МБ — портал его не примет. ` +
          `Портрет показывается кружком, ему хватит небольшого снимка.`,
      );
      return;
    }
    await действие(() => uploadMyAvatar(file));
  }

  async function действие(что: () => Promise<unknown>) {
    занять(true);
    сказать(null);
    try {
      await что();
      // Кеш портретов держит прежнее лицо: без этого кружок в шапке
      // показывал бы старое до перезагрузки страницы.
      forgetPortrait(login);
    } catch (e) {
      сказать(message(e));
    } finally {
      занять(false);
      // Сброс поля: без него выбор того же файла второй раз не вызывает
      // onChange — браузер считает, что ничего не изменилось.
      if (поле.current) поле.current.value = "";
    }
  }

  return (
    <div className="admin-card">
      <div className="portrait">
        <Avatar name={login} login={login} size="xl" />

        <div className="portrait__actions">
          <label className="file">
            <input
              ref={поле}
              type="file"
              accept="image/jpeg,image/png"
              aria-label="Свой портрет"
              disabled={занято}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void загрузить(file);
              }}
            />
            <span className="file__word">
              {портрет ? "заменить портрет" : "загрузить портрет"}
            </span>
          </label>

          {портрет && (
            <button
              className="btn btn--small"
              type="button"
              disabled={занято}
              onClick={() => void действие(() => removeMyAvatar())}
            >
              Убрать
            </button>
          )}
        </div>
      </div>

      <Note kind="error">{ошибка}</Note>

      <p className="admin-hint">
        JPEG или PNG до {AVATAR_MAX_BYTES / 1024 / 1024} МБ, стороной от 64 до 4096 точек.
        Портал хранит не присланный файл, а собранный из него квадрат 256×256: всё, что
        ехало рядом с картинкой — включая координаты съёмки из снимка телефоном, — до
        хранилища не доезжает. Формат определяется по содержимому файла, а не по его
        имени.
      </p>

      <p className="admin-hint">
        Портрет видят только сотрудники: он лежит в базе портала и отдаётся дверью
        с проверкой входа, а не ссылкой наружу. Пока портрета нет, на его месте
        стоит кружок с первой буквой логина — и он никуда не денется.
      </p>
    </div>
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
