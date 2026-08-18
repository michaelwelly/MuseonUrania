import Link from "next/link";
import Image from "next/image";
import { membership } from "@/content/about";
import { footer, site } from "@/content/site";
import FooterSubscribe from "./FooterSubscribe";
import styles from "./Footer.module.css";

export default function Footer() {
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
              горизонтального начертания, а не квадратная. */}
          <a
            className={styles.membership}
            href={membership.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${membership.title}: ${membership.mark.alt}`}
          >
            <Image
              src={membership.markWide.src}
              alt={membership.markWide.alt}
              width={membership.markWide.width}
              height={membership.markWide.height}
            />
          </a>
          <p className={styles.about}>{footer.about}</p>
          <div className={styles.messengers}>
            {footer.messengers.map((m) =>
              m.href ? (
                <a key={m.label} className={styles.pill} href={m.href}>
                  {m.label}
                </a>
              ) : (
                <span
                  key={m.label}
                  className={`${styles.pill} ${styles.pillMuted}`}
                  title="Ссылка на аккаунт ожидает уточнения"
                >
                  {m.label}
                </span>
              ),
            )}
          </div>
        </div>

        {footer.columns.map((column) => (
          <nav key={column.title}>
            <p className={styles.colTitle}>{column.title}</p>
            <div className={styles.links}>
              {column.links.map((link) => (
                <Link key={`${column.title}-${link.label}`} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        ))}

        <div className={styles.right}>
          <div>
            <p className={styles.colTitle}>Контакты</p>
            <address className={styles.contacts}>
              <a className={styles.phone} href={`tel:${site.phone.replace(/\s/g, "")}`}>
                {site.phone}
              </a>
              {/* Второй номер снят по §9.2 плана: он не подтверждён заказчиком. */}
              <a className={styles.contactLine} href={`mailto:${site.email}`}>
                {site.email}
              </a>
              <span className={styles.address}>{site.address} — производство</span>
            </address>
          </div>

          <FooterSubscribe />
        </div>
      </div>

      <div className={styles.bottom}>
        <span>
          © {new Date().getFullYear()} {site.legalName}
        </span>
        <span>ИНН {site.inn}</span>
        <span>КПП {site.kpp}</span>
        {/* §14.1 плана: ссылка на политику стоит в конце каждой страницы.
            Раньше здесь был неактивный текст — вести было некуда. Страница
            по адресу ниже не содержит текста политики: он готовится и до
            проверки юристом не публикуется (§14.7). Она показывает статус,
            реквизиты оператора и контакт для обращений. */}
        <Link className={styles.contactLine} href="/legal/privacy/">
          Политика обработки персональных данных
        </Link>
        {/* Дверь сотрудника. prefetch={false} обязателен: у сайта и админки
            разные корневые layout'ы, переход всё равно перезагружает страницу
            целиком, а предзагрузка тянула бы бандл админки каждому посетителю
            сайта — ради ссылки, которой воспользуются несколько человек. */}
        <Link className={styles.staff} href="/admin/" prefetch={false}>
          Вход для сотрудников
        </Link>
        <span className={styles.disclaimer}>{footer.disclaimer}</span>
        <span className={styles.disclaimer}>{footer.copyright}</span>
      </div>
    </footer>
  );
}
