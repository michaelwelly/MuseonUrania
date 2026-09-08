import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import TranslationNotice from "@/components/TranslationNotice";
import TreeMark from "@/components/TreeMark";
import { DarkCta } from "@/components/Blocks";
import {
  aboutHero,
  cycle,
  membership,
  legal,
  aboutCta,
} from "@/content/about";
import { ui } from "@/content/ui";
import styles from "./page.module.css";
import { contentText } from "@/lib/content-i18n";
import { localePath, type Lang } from "@/lib/i18n";
import { mediaSrc } from "@/lib/media";

// «О компании». Тело вынесено из `page.tsx` в `screen.tsx`, потому что его
// рисуют два маршрута: `/about/` (русский) и `/[lang]/about/` (переведённый).
//
// Почти всё на этой странице — утверждения о компании: состав цикла,
// членство в палате, реквизиты. Их переводит заказчик, поэтому они идут
// через `contentText`, а не через словарь интерфейса.

export function aboutMetadata(lang: Lang): Metadata {
  const strings = ui(lang);
  const c = contentText(lang);
  return pageMetadata({
    title: strings.meta.about,
    description: c.t(aboutHero.lead),
    path: "/about/",
    lang,
  });
}

export default function AboutScreen({ lang }: { lang: Lang }) {
  const strings = ui(lang);
  const c = contentText(lang);
  const at = (path: string) => localePath(lang, path);

  return (
    <main className={styles.page}>
      {/* Заголовок и подзаголовок первого экрана — содержательный текст, но
          пометить их `lang="ru"` отсюда нельзя: PageHero принимает строки,
          а атрибут ставится на элемент внутри него. Про непереведённое
          говорит примечание сразу под первым экраном. */}
      <PageHero
        crumbs={[{ label: strings.crumbs.home, href: at("/") }, { label: strings.crumbs.about }]}
        title={c.t(aboutHero.title)}
        lead={c.t(aboutHero.lead)}
        textLang={c.mark(aboutHero.title, aboutHero.lead)}
      />

      {/* Примечание о непереведённом стоит сразу после первого экрана:
          дальше идут реквизиты и утверждения о компании, их перевод
          согласовывает заказчик. Для русской версии не рисуется. */}
      <TranslationNotice lang={lang} />

      <div className={styles.banner} data-reveal="0">
        <Image
          src={mediaSrc(aboutHero.image.src)}
          alt={c.t(aboutHero.image.alt)}
          fill
          sizes="100vw"
          priority
        />
      </div>

      <section className={styles.cycle}>
        <div data-reveal="0">
          <p className={styles.eyebrow} lang={c.mark(cycle.eyebrow)}>
            {c.t(cycle.eyebrow)}
          </p>
          <h2 className={styles.cycleTitle} data-words="30" lang={c.mark(cycle.title)}>
            {c.t(cycle.title)}
          </h2>
        </div>
        <div data-reveal="1">
          {cycle.paragraphs.map((p) => (
            <p key={p} className={styles.paragraph} lang={c.mark(p)}>
              {c.t(p)}
            </p>
          ))}
          <ul className={styles.grid2}>
            {cycle.items.map((it) => (
              // Ключ остаётся русским оригиналом: он и в словаре переводов
              // ключ, и здесь идентификатор строки списка.
              <li key={it.n} className={styles.cell} lang={c.mark(it.title, it.text)}>
                <p className={styles.num}>{it.n}</p>
                <h3 className={styles.cellTitle}>{c.t(it.title)}</h3>
                <p className={styles.cellText}>{c.t(it.text)}</p>
              </li>
            ))}
          </ul>
        </div>
        {/* §11.2: место маркировочного знака. Рисуется, когда заказчик
            передаст файл — см. content/brand.ts. */}
        <TreeMark where="about" />
      </section>

      {/* Членство в УТПП, а не коммерческое партнёрство: блок намеренно
          отдельный и без интеграторов — §2.6 плана. Знак ведёт на сайт
          палаты, как просил заказчик. */}
      <section className={styles.membership}>
        <div className={styles.membershipCopy} data-reveal="0">
          <p className={styles.eyebrow} lang={c.mark(membership.eyebrow)}>
            {c.t(membership.eyebrow)}
          </p>
          <h2 className={styles.membershipTitle} data-words="30" lang={c.mark(membership.title)}>
            {c.t(membership.title)}
          </h2>
          <p className={styles.membershipText} lang={c.mark(membership.text)}>
            {c.t(membership.text)}
          </p>
          {/* Подпись ссылки — доменное имя. Через `c.t` не идёт и не
              помечается русским: домен не переводится ни на один язык
              (правило 5 в CLAUDE.md), а пометка `lang="ru"` заставила бы
              скринридер читать латиницу по-русски. */}
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
            alt={c.t(membership.mark.alt)}
            width={membership.mark.width}
            height={membership.mark.height}
          />
        </div>
      </section>

      <section className={styles.legal}>
        <div data-reveal="0">
          <h2 className={styles.legalTitle} data-words="30" lang={c.mark(legal.title)}>
            {c.t(legal.title)}
          </h2>
          <div className={styles.table}>
            {legal.rows.map((row) => (
              // Реквизиты юридического лица: наименование, адрес, ИНН/КПП.
              // Ровно тот случай, где перевод — новая редакция документа,
              // а не пересказ; до согласования строка остаётся русской.
              <div key={row.label} className={styles.row} lang={c.mark(row.label, row.value)}>
                <span className={styles.rowLabel}>{c.t(row.label)}</span>
                <span>{c.t(row.value)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.legalPhoto} data-reveal="1">
          <Image
            src={mediaSrc(legal.image.src)}
            alt={c.t(legal.image.alt)}
            fill
            sizes="(max-width: 1100px) 100vw, 45vw"
          />
        </div>
      </section>

      {/* Заголовок и текст полосы-призыва тоже содержательные, и пометить их
          отсюда нельзя по той же причине, что и первый экран: DarkCta
          принимает строки. Подписи кнопок — интерфейс, они переводятся. */}
      <DarkCta
        title={c.t(aboutCta.title)}
        text={c.t(aboutCta.text)}
        textLang={c.mark(aboutCta.title, aboutCta.text)}
        primary={{
          label: strings.actions.requestQuote,
          href: at("/contacts/"),
          analytics: "hero_quote_click",
        }}
        secondary={{ label: strings.actions.contacts, href: at("/contacts/") }}
      />
    </main>
  );
}
