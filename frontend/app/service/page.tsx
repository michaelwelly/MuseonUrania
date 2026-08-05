import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { site, urania } from "@/content/site";
import { serviceHero, serviceForm, serviceNotice } from "@/content/service";
import LeadForm from "@/components/LeadForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Сервис — VEDAL",
  description: serviceHero.lead,
};

export default function ServicePage() {
  return (
    <main className={styles.page}>
      <section className={styles.section}>
        <div className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>{serviceHero.eyebrow}</p>
            <h1 className={styles.h1}>{serviceHero.headline}</h1>
            <p className={styles.lead}>{serviceHero.lead}</p>
          </div>
          <div className={styles.heroImage}>
            <Image
              src={serviceHero.image.src}
              alt={serviceHero.image.alt}
              fill
              sizes="(max-width: 1000px) 100vw, 50vw"
              priority
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.split}>
          <div>
            <h2 className={styles.h2}>{serviceForm.title}</h2>
            <LeadForm analytics="service_form_submit" />
          </div>

          <div className={styles.aside}>
            <p className={styles.asideTitle}>Связаться напрямую</p>
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
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{serviceNotice.title}</h2>
        <p className={styles.note}>{serviceNotice.text}</p>
      </section>

      <section className={styles.section}>
        <div className={styles.assistant}>
          <div>
            <h2 className={styles.h2}>Не уверены, что это сервисный случай?</h2>
            <p className={styles.lead}>
              {urania.name} уточнит детали и передаст обращение специалисту. Технических
              указаний по ремонту ассистент не даёт.
            </p>
          </div>
          <div className={styles.actions}>
            {/* Панели чата ещё нет, ведём к карточке ассистента на главной. */}
            <Link
              className={styles.button}
              href="/#urania"
              data-analytics="urania_quick_action_click"
            >
              Спросить {urania.name}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
