import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import LeadForm from "@/components/LeadForm";
import { fetchProducts } from "@/lib/api";
import { site } from "@/content/site";
import { serviceHero, steps, serviceForm, serviceNotice, urgent } from "@/content/service";
import { companyContact, STAFF_AWAITING } from "@/content/staff";
import styles from "./page.module.css";
import { mediaSrc } from "@/lib/media";

export const metadata: Metadata = {
  title: "Сервис — VEDAL",
  description: serviceHero.lead,
};

export default async function ServicePage() {
  const products = await fetchProducts();

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.crumbs}>
            <Link href="/">Главная</Link> / Сервис
          </p>
          <h1 className={styles.h1} data-words="34" data-wdelay="110">
            {serviceHero.title}
          </h1>
          <p className={styles.lead} data-words="13" data-wdelay="400">
            {serviceHero.lead}
          </p>
        </div>
        <div className={styles.photo} data-anim="clip">
          <Image
            src={mediaSrc(serviceHero.image.src)}
            alt={serviceHero.image.alt}
            fill
            sizes="(max-width: 1100px) 100vw, 50vw"
            priority
          />
        </div>
      </section>

      <ul className={styles.steps}>
        {steps.map((s, i) => (
          <li key={s.n} className={styles.step} data-reveal={i}>
            <p className={styles.num}>{s.n}</p>
            <h2 className={styles.stepTitle}>{s.title}</h2>
            <p className={styles.stepText}>{s.text}</p>
          </li>
        ))}
      </ul>

      <section className={styles.body}>
        <div className={styles.card} data-reveal="0">
          <h2 className={styles.formTitle} data-words="30">
            {serviceForm.title}
          </h2>
          <LeadForm
            form="service"
            products={products}
            analytics="service_form_submit"
            hint={serviceForm.hint}
          />
        </div>

        <div className={styles.aside} data-reveal="1">
          <div className={styles.engineer}>
            <p className={styles.asideLabel}>Сервисное обращение</p>
            <div className={styles.person}>
              <div className={styles.avatar}>
                <Image
                  src="/urania/urania-avatar-middle-v1.png"
                  alt=""
                  fill
                  sizes="64px"
                />
              </div>
              <div>
                <p className={styles.personName}>{companyContact.title}</p>
                <p className={styles.personRole}>{companyContact.scope}</p>
              </div>
            </div>
            <address className={styles.personContacts}>
              <a
                className={styles.personPhone}
                href={`tel:${companyContact.phone.replace(/[\s+]/g, "")}`}
              >
                {companyContact.phone}
              </a>
              <a className={styles.personMail} href={`mailto:${companyContact.email}`}>
                {companyContact.email}
              </a>
            </address>
          </div>

          {/* Именной инженер вернётся, когда заказчик подтвердит контакты. */}
          <p className={styles.demoNote}>{STAFF_AWAITING}</p>

          <div className={styles.notice}>
            <h2 className={styles.noticeTitle}>{serviceNotice.title}</h2>
            <p className={styles.noticeText}>{serviceNotice.text}</p>
          </div>

          <div className={styles.urgent}>
            <h2 className={styles.urgentTitle}>{urgent.title}</h2>
            <p className={styles.urgentText}>{urgent.text}</p>
            <a className={styles.urgentPhone} href={`tel:${site.phone.replace(/\s/g, "")}`}>
              {site.phone}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
