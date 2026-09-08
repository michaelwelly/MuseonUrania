import Link from "next/link";
import Image from "next/image";
import { membership } from "@/content/about";
import { footer, site } from "@/content/site";
import { ui } from "@/content/ui";
import { contentText } from "@/lib/content-i18n";
import { localePath, type Lang } from "@/lib/i18n";
import FooterSubscribe from "./FooterSubscribe";
import styles from "./Footer.module.css";

export default function Footer({ lang }: { lang: Lang }) {
  const strings = ui(lang);
  const c = contentText(lang);
  // Подписи ссылок подвала берутся из двух наборов: часть повторяет пункты
  // меню («О компании», «Производство», «Новости»), часть есть только здесь
  // («Документы и лицензии», «Неонатология»). Держать вторую копию первых
  // значило бы завести место, где подвал разойдётся с меню.
  const label = { ...strings.nav, ...strings.footer };

  return (
    <footer className={styles.footer}>
      <div className={styles.top}>
        <div>
          {/* Раньше здесь стоял знак VEDAL на белой плашке. Плашка была нужна
              не по замыслу, а вынужденно: знак нарисован почти чёрным (#111),
              и на фоне подвала (#08211d) его контраст — 1.12:1, то есть его
              не видно. Логотип и так стоит в шапке каждой страницы, поэтому
              в подвале его место занял знак члена палаты.

              Подложка под ним осталась светлой по той же причине: знак палаты
              бордовый (#812a5d), на фоне подвала это 1.94:1. Перекрасить его
              нельзя — чужой фирменный знак. Плашка подогнана под пропорции
              горизонтального начертания, а не квадратная.

              Раньше знак был кликабельной ссылкой на uralcci.com — так же,
              как на «О компании» до GitHub issue #67. По итогам просмотра
              стенда заказчиком 8 сентября решение то же и здесь: знак
              остаётся, переход убран — ссылка на сайт палаты не была явно
              обозначена как ссылка, и клик по картинке выглядел случайным
              переходом. */}
          <div className={styles.membership}>
            <Image
              src={membership.markWide.src}
              alt={c.t(membership.markWide.alt)}
              width={membership.markWide.width}
              height={membership.markWide.height}
            />
          </div>
          {/* Описание компании — содержательный текст: что и для кого
              производим. Переводит заказчик; до перевода стоит русский
              оригинал, помеченный lang. */}
          <p className={styles.about} lang={c.mark(footer.about)}>
            {c.t(footer.about)}
          </p>
          {/* Кнопки соцсетей скрыты из вёрстки целиком, а не только сделаны
              некликабельными: по итогам просмотра стенда заказчиком
              8 сентября (GitHub issue #69) — подтверждённых ссылок на
              аккаунты нет, показывать пустые «пилюли» не нужно. Данные
              остаются в content/site.ts (footer.messengers), верстка
              вернётся одной правкой, когда заказчик передаст адреса. */}
        </div>

        {footer.columns.map((column) => (
          <nav key={column.key}>
            <p className={styles.colTitle}>{label[column.key]}</p>
            <div className={styles.links}>
              {column.links.map((link) => (
                <Link key={`${column.key}-${link.key}`} href={localePath(lang, link.href)}>
                  {label[link.key]}
                </Link>
              ))}
            </div>
          </nav>
        ))}

        <div className={styles.right}>
          <div>
            <p className={styles.colTitle}>{strings.footer.contacts}</p>
            <address className={styles.contacts}>
              <a className={styles.phone} href={`tel:${site.phone.replace(/\s/g, "")}`}>
                {site.phone}
              </a>
              {/* Второй номер снят по §9.2 плана: он не подтверждён заказчиком. */}
              <a className={styles.contactLine} href={`mailto:${site.email}`}>
                {site.email}
              </a>
              {/* Адрес не переводится: это почтовый адрес, по нему ездят.
                  Переведена только подпись «производство». */}
              <span className={styles.address} lang={c.mark(site.address)}>
                {site.address} {strings.footer.productionSuffix}
              </span>
            </address>
          </div>

          <FooterSubscribe lang={lang} />
        </div>
      </div>

      <div className={styles.bottom}>
        <span lang={c.mark(site.legalName)}>
          © {new Date().getFullYear()} {c.t(site.legalName)}
        </span>
        <span>ИНН {site.inn}</span>
        <span>КПП {site.kpp}</span>
        {/* §14.1 плана: ссылка на политику стоит в конце каждой страницы.
            Раньше здесь был неактивный текст — вести было некуда. Страница
            по адресу ниже не содержит текста политики: он готовится и до
            проверки юристом не публикуется (§14.7). Она показывает статус,
            реквизиты оператора и контакт для обращений. */}
        <Link className={styles.contactLine} href={localePath(lang, "/legal/privacy/")}>
          {strings.footer.privacy}
        </Link>
        {/* Дверь сотрудника. prefetch={false} обязателен: у сайта и админки
            разные корневые layout'ы, переход всё равно перезагружает страницу
            целиком, а предзагрузка тянула бы бандл админки каждому посетителю
            сайта — ради ссылки, которой воспользуются несколько человек.

            Адрес без языкового префикса: админка одноязычная, у неё свой
            корневой layout и своя навигация. */}
        <Link className={styles.staff} href="/admin/" prefetch={false}>
          {strings.footer.staffLogin}
        </Link>
        {/* Оговорка про оферту и регистрационные удостоверения — юридический
            текст. Машинный перевод такого недопустим: «регистрационное
            удостоверение» и «registration certificate» — не одно и то же. */}
        <span className={styles.disclaimer} lang={c.mark(footer.disclaimer)}>
          {c.t(footer.disclaimer)}
        </span>
        <span className={styles.disclaimer} lang={c.mark(footer.copyright)}>
          {c.t(footer.copyright)}
        </span>
      </div>
    </footer>
  );
}
