import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import LeadForm from "@/components/LeadForm";
import TranslationNotice from "@/components/TranslationNotice";
import { fetchProducts } from "@/lib/api";
import { site } from "@/content/site";
import { serviceHero, steps, serviceForm, serviceNotice, urgent } from "@/content/service";
import { companyContact } from "@/content/staff";
import { ui } from "@/content/ui";
import { vedalina } from "@/content/vedalina";
import LivePattern from "@/components/LivePattern";
import styles from "./page.module.css";
import { contentText } from "@/lib/content-i18n";
import { localePath, type Lang } from "@/lib/i18n";
import { mediaSrc } from "@/lib/media";

// «Сервис». Тело вынесено из `page.tsx` в `screen.tsx`, потому что его рисуют
// два маршрута: `/service/` (русский) и `/[lang]/service/` (переведённый).
//
// Экран остаётся асинхронным: список изделий для селектора формы приходит
// с бэкенда, и оба маршрута ждут его одинаково.
//
// Предупреждение о технической документации переводу не подлежит вовсе:
// page_briefs.md → Service → Safety требует не смягчать формулировку,
// а перевод — это и есть её новая редакция.

export function serviceMetadata(lang: Lang): Metadata {
  const strings = ui(lang);
  const c = contentText(lang);
  return pageMetadata({
    title: strings.meta.service,
    description: c.t(serviceHero.lead),
    path: "/service/",
    lang,
  });
}

export default async function ServiceScreen({ lang }: { lang: Lang }) {
  const products = await fetchProducts();
  const strings = ui(lang);
  const c = contentText(lang);
  const at = (path: string) => localePath(lang, path);

  return (
    <main className={styles.page}>
      {/* Паттерна нет по той же причине, что на главной: правая половина
          полосы занята фото во всю высоту, и класть композицию за него
          или под текст одинаково плохо. */}
      <section className={`${styles.hero} patternHost`}>
        <LivePattern variant={2} placement="seam" />
        <div className={styles.heroCopy}>
          <p className={styles.crumbs}>
            <Link href={at("/")}>{strings.crumbs.home}</Link> / {strings.crumbs.service}
          </p>
          <h1
            className={styles.h1}
            data-words="34"
            data-wdelay="110"
            lang={c.mark(serviceHero.title)}
          >
            {c.t(serviceHero.title)}
          </h1>
          <p
            className={styles.lead}
            data-words="13"
            data-wdelay="400"
            lang={c.mark(serviceHero.lead)}
          >
            {c.t(serviceHero.lead)}
          </p>
        </div>
        <div className={styles.photo} data-anim="clip">
          <Image
            src={mediaSrc(serviceHero.image.src)}
            alt={c.t(serviceHero.image.alt)}
            fill
            sizes="(max-width: 1100px) 100vw, 50vw"
            priority
          />
        </div>
      </section>

      {/* Примечание о непереведённом стоит сразу после первого экрана:
          ниже идут порядок работы с обращением и предупреждение о
          технической документации — их перевод согласовывает заказчик.
          Для русской версии не рисуется. */}
      <TranslationNotice lang={lang} />

      <ul className={styles.steps}>
        {steps.map((s, i) => (
          <li key={s.n} className={styles.step} data-reveal={i} lang={c.mark(s.title, s.text)}>
            <p className={styles.num}>{s.n}</p>
            <h2 className={styles.stepTitle}>{c.t(s.title)}</h2>
            <p className={styles.stepText}>{c.t(s.text)}</p>
          </li>
        ))}
      </ul>

      <section className={styles.body}>
        <div className={styles.card} data-reveal="0">
          <h2 className={styles.formTitle} data-words="30" lang={c.mark(serviceForm.title)}>
            {c.t(serviceForm.title)}
          </h2>
          {/* Подписи полей, кнопка и тексты ошибок формы берутся из словаря
              интерфейса внутри самого LeadForm — ему довольно языка.
              Подсказка про часы ответа приходит отсюда: она лежит
              в content/service.ts вместе с остальным обещанием компании. */}
          <LeadForm
            form="service"
            products={products}
            analytics="service_form_submit"
            hint={c.t(serviceForm.hint)}
            lang={lang}
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
              <div lang={c.mark(companyContact.title, companyContact.scope)}>
                <p className={styles.personName}>{c.t(companyContact.title)}</p>
                <p className={styles.personRole}>{c.t(companyContact.scope)}</p>
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

          <div className={styles.notice} lang={c.mark(serviceNotice.title, serviceNotice.text)}>
            <h2 className={styles.noticeTitle}>{c.t(serviceNotice.title)}</h2>
            <p className={styles.noticeText}>{c.t(serviceNotice.text)}</p>
          </div>

          <div className={styles.urgent}>
            <h2 className={styles.urgentTitle} lang={c.mark(urgent.title)}>
              {c.t(urgent.title)}
            </h2>
            <p className={styles.urgentText} lang={c.mark(urgent.text)}>
              {c.t(urgent.text)}
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
