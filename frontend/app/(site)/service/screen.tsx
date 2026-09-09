import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import LeadForm from "@/components/LeadForm";
import { fetchProducts } from "@/lib/api";
import { site } from "@/content/site";
import { serviceHero, steps, serviceForm, serviceNotice, urgent } from "@/content/service";
import { companyContact } from "@/content/staff";
import { ui as strings } from "@/content/ui";
import { vedalina } from "@/content/vedalina";
import LivePattern from "@/components/LivePattern";
import styles from "./page.module.css";
import { mediaSrc } from "@/lib/media";

// «Сервис». Тело вынесено из `page.tsx` в `screen.tsx`, потому что
// `screen.tsx` маршрутом не является: здесь можно держать любые экспорты
// и рисовать экран из тестов, чего `page.tsx` не позволяет.
//
// Экран остаётся асинхронным: список изделий для селектора формы приходит
// с бэкенда.
//
// Предупреждение о технической документации экран не сочиняет и не смягчает:
// page_briefs.md → Service → Safety требует именно ту формулировку, что лежит
// в content/service.ts.

export function serviceMetadata(): Metadata {
  return pageMetadata({
    title: strings.meta.service,
    description: serviceHero.lead,
    path: "/service/",
  });
}

export default async function ServiceScreen() {
  const products = await fetchProducts();

  return (
    <main className={styles.page}>
      {/* Паттерна нет по той же причине, что на главной: правая половина
          полосы занята фото во всю высоту, и класть композицию за него
          или под текст одинаково плохо. */}
      <section className={`${styles.hero} patternHost`}>
        <LivePattern variant={2} placement="seam" />
        <div className={styles.heroCopy}>
          <p className={styles.crumbs}>
            <Link href="/">{strings.crumbs.home}</Link> / {strings.crumbs.service}
          </p>
          <h1
            className={styles.h1}
            data-words="34"
            data-wdelay="110"
          >
            {serviceHero.title}
          </h1>
          <p
            className={styles.lead}
            data-words="13"
            data-wdelay="400"
          >
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
          {/* Подписи полей, кнопка и тексты ошибок формы берутся из словаря
              интерфейса внутри самого LeadForm. Подсказка про часы ответа
              приходит отсюда: она лежит в content/service.ts вместе
              с остальным обещанием компании. */}
          <LeadForm
            form="service"
            products={products}
            analytics="service_form_submit"
            hint={serviceForm.hint}
          />
        </div>

        <div className={styles.aside} data-reveal="1">
          <div className={styles.engineer}>
            <p className={styles.asideLabel}>{strings.service.enquiryLabel}</p>
            <div className={styles.person}>
              <div className={styles.avatar}>
                <Image src={vedalina.avatar} alt="" width={46} height={46} />
              </div>
              {/* Наименование юрлица и круг вопросов, по которым отвечают, —
                  утверждение о компании, а не подпись интерфейса. */}
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

          <div className={styles.notice}>
            <h2 className={styles.noticeTitle}>{serviceNotice.title}</h2>
            <p className={styles.noticeText}>{serviceNotice.text}</p>
          </div>

          <div className={styles.urgent}>
            <h2 className={styles.urgentTitle}>
              {urgent.title}
            </h2>
            <p className={styles.urgentText}>
              {urgent.text}
            </p>
            <a className={styles.urgentPhone} href={`tel:${site.phone.replace(/\s/g, "")}`}>
              {site.phone}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
