import Link from "next/link";
import Image from "next/image";
import { nav, site } from "@/content/site";
import styles from "./Footer.module.css";

// Футер по docs/frontend/sitemap.md. Ссылки на <a>: маршруты, кроме «/» и
// «/about/», ещё не созданы. Правовые тексты и согласие на обработку данных
// появятся вместе с формами — сейчас их публиковать не из чего.
export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.top}>
        <div>
          <Link href="/" className={styles.brand} aria-label={`${site.brand}, на главную`}>
            <Image
              src={site.logo.src}
              alt={site.brand}
              width={site.logo.width}
              height={site.logo.height}
            />
          </Link>
          <p className={styles.tagline}>
            Российское производство оборудования для неонатологии, реанимации,
            анестезиологии и интенсивной терапии.
          </p>
        </div>

        <nav aria-label="Разделы сайта">
          <p className={styles.colTitle}>Разделы</p>
          <ul className={styles.links}>
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className={styles.colTitle}>Контакты</p>
          <address className={styles.contacts}>
            <a className={styles.phone} href={`tel:${site.phone.replace(/\s/g, "")}`}>
              {site.phone}
            </a>
            <a href={`tel:${site.phoneExtra.replace(/[\s-]/g, "")}`}>{site.phoneExtra}</a>
            <span className={styles.hours}>{site.phoneHours}</span>
            <a href={`mailto:${site.email}`}>{site.email}</a>
            <span className={styles.address}>{site.address}</span>
          </address>
        </div>
      </div>

      <div className={styles.bottom}>
        <span>
          © {new Date().getFullYear()} {site.legalName}
        </span>
        <span>
          ИНН {site.inn} · КПП {site.kpp}
        </span>
        <span className={styles.disclaimer}>
          Информация на сайте не является публичной офертой. Регистрационные
          удостоверения и сертификаты публикуются после согласования.
        </span>
      </div>
    </footer>
  );
}
