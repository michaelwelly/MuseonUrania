import Link from "next/link";
import AnimatedLogo from "@/components/AnimatedLogo";
import { footer, site } from "@/content/site";
import FooterSubscribe from "./FooterSubscribe";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.top}>
        <div>
          <Link href="/" className={styles.brand} aria-label={`${site.brand}, на главную`}>
            {/* 40 — та же высота, что была у статичного знака в .brand img. */}
            <AnimatedLogo height={40} />
          </Link>
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
              <a
                className={styles.contactLine}
                href={`tel:${site.phoneExtra.replace(/[\s-]/g, "")}`}
              >
                {site.phoneExtra}
              </a>
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
        <span title="Текст политики ожидает уточнения">
          Политика обработки персональных данных
        </span>
        <span className={styles.disclaimer}>{footer.disclaimer}</span>
      </div>
    </footer>
  );
}
