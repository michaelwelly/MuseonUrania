import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import TreeMark from "@/components/TreeMark";
import { DarkCta } from "@/components/Blocks";
import {
  aboutHero,
  cycle,
  membership,
  legal,
  aboutCta,
} from "@/content/about";
import { ui as strings } from "@/content/ui";
import styles from "./page.module.css";
import { mediaSrc } from "@/lib/media";

// «О компании». Тело вынесено из `page.tsx` в `screen.tsx`, потому что
// `screen.tsx` маршрутом не является: Next знает только `page`, `layout`,
// `route` и ещё несколько имён. Здесь можно держать любые экспорты и рисовать
// экран из тестов, чего `page.tsx` не позволяет.
//
// Почти всё на этой странице — утверждения о компании: состав цикла,
// членство в палате, реквизиты. Правит их заказчик, поэтому они лежат
// в `content/about.ts`, а не в словаре интерфейса.

export function aboutMetadata(): Metadata {
  return pageMetadata({
    title: strings.meta.about,
    description: aboutHero.lead,
    path: "/about/",
  });
}

export default function AboutScreen() {
  return (
    <main className={styles.page}>
      <PageHero
        crumbs={[{ label: strings.crumbs.home, href: "/" }, { label: strings.crumbs.about }]}
        title={aboutHero.title}
        lead={aboutHero.lead}
      />

      <div className={styles.banner} data-reveal="0">
        <Image
          src={mediaSrc(aboutHero.image.src)}
          alt={aboutHero.image.alt}
          fill
          sizes="100vw"
          priority
        />
      </div>

      <section className={styles.cycle}>
        <div data-reveal="0">
          <p className={styles.eyebrow}>
            {cycle.eyebrow}
          </p>
          <h2 className={styles.cycleTitle} data-words="30">
            {cycle.title}
          </h2>
          {/* Знак стоит под заголовком, а не отдельной строкой под всей
              секцией. Раньше он был третьим элементом сетки и падал
              в левую колонку следующего ряда: под заголовком оставалась
              колонка пустого белого в половину экрана, а знак висел внизу
              сам по себе, ни к чему не примыкая. Владелец портала указал
              на эту пустоту, глядя на боевую страницу. */}
          <TreeMark where="about" />
        </div>
        <div data-reveal="1">
          {cycle.paragraphs.map((p) => (
            <p key={p} className={styles.paragraph}>
              {p}
            </p>
          ))}
          <ul className={styles.grid2}>
            {cycle.items.map((it) => (
              <li key={it.n} className={styles.cell}>
                <p className={styles.num}>{it.n}</p>
                <h3 className={styles.cellTitle}>{it.title}</h3>
                <p className={styles.cellText}>{it.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Членство в УТПП, а не коммерческое партнёрство: блок намеренно
          отдельный и без интеграторов — §2.6 плана. Знак ведёт на сайт
          палаты, как просил заказчик. */}
      <section className={styles.membership}>
        <div className={styles.membershipCopy} data-reveal="0">
          <p className={styles.eyebrow}>
            {membership.eyebrow}
          </p>
          <h2 className={styles.membershipTitle} data-words="30">
            {membership.title}
          </h2>
          <p className={styles.membershipText}>
            {membership.text}
          </p>
          <a
            className={styles.membershipLink}
            href={membership.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {membership.linkLabel}
          </a>
        </div>
        {/* Знак — не кнопка: ссылка на палату уже стоит текстом выше
            (membershipLink), а сам знак раньше тоже вёл по тому же адресу,
            из-за чего на нём был неочевидный переход без явного признака
            ссылки. GitHub issue #67: знак остаётся, переход убран. */}
        <div className={styles.membershipMark} data-reveal="1">
          <Image
            src={membership.mark.src}
            alt={membership.mark.alt}
            width={membership.mark.width}
            height={membership.mark.height}
          />
        </div>
      </section>

      <section className={styles.legal}>
        <div data-reveal="0">
          <h2 className={styles.legalTitle} data-words="30">
            {legal.title}
          </h2>
          <div className={styles.table}>
            {legal.rows.map((row) => (
              <div key={row.label} className={styles.row}>
                <span className={styles.rowLabel}>{row.label}</span>
                <span>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.legalPhoto} data-reveal="1">
          <Image
            src={mediaSrc(legal.image.src)}
            alt={legal.image.alt}
            fill
            sizes="(max-width: 1100px) 100vw, 45vw"
          />
        </div>
      </section>

      <DarkCta
        title={aboutCta.title}
        text={aboutCta.text}
        primary={{
          label: strings.actions.requestQuote,
          href: "/contacts/",
          analytics: "hero_quote_click",
        }}
        secondary={{ label: strings.actions.contacts, href: "/contacts/" }}
      />
    </main>
  );
}
