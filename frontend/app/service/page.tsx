import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import LeadForm from "@/components/LeadForm";
import { site } from "@/content/site";
import { serviceHero, steps, serviceForm, serviceNotice, urgent } from "@/content/service";
import { serviceEngineer, DEMO_NOTE } from "@/content/staff";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Сервис — VEDAL",
  description: serviceHero.lead,
};

export default function ServicePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.crumbs}>
            <Link href="/">Главная</Link> / Сервис
          </p>
          <h1 className={styles.h1}>{serviceHero.title}</h1>
          <p className={styles.lead}>{serviceHero.lead}</p>
        </div>
        <div className={styles.photo}>
          <Image
            src={serviceHero.image.src}
            alt={serviceHero.image.alt}
            fill
            sizes="(max-width: 1100px) 100vw, 50vw"
            priority
          />
        </div>
      </section>

      <ul className={styles.steps}>
        {steps.map((s) => (
          <li key={s.n} className={styles.step}>
            <p className={styles.num}>{s.n}</p>
            <h2 className={styles.stepTitle}>{s.title}</h2>
            <p className={styles.stepText}>{s.text}</p>
          </li>
        ))}
      </ul>

      <section className={styles.body}>
        <div className={styles.card}>
          <h2 className={styles.formTitle}>{serviceForm.title}</h2>
          <LeadForm analytics="service_form_submit" hint={serviceForm.hint} />
        </div>

        <div className={styles.aside}>
          <div className={styles.engineer}>
            <p className={styles.asideLabel}>Ваш инженер</p>
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
                <p className={styles.personName}>{serviceEngineer.name}</p>
                <p className={styles.personRole}>{serviceEngineer.role}</p>
              </div>
            </div>
            <address className={styles.personContacts}>
              <a
                className={styles.personPhone}
                href={`tel:${serviceEngineer.phone.replace(/[\s+]/g, "")}`}
              >
                {serviceEngineer.phone}
              </a>
              <a className={styles.personMail} href={`mailto:${serviceEngineer.email}`}>
                {serviceEngineer.email}
              </a>
            </address>
          </div>

          {/* Данные инженера — заглушка из макета, см. content/staff.ts */}
          <p className={styles.demoNote}>{DEMO_NOTE}</p>

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
