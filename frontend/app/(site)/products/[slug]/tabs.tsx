"use client";

import { useState } from "react";
import Link from "next/link";
import { ui } from "@/content/ui";
import type { Doc, Product } from "@/lib/api";
import { REQUEST_HREF, accessBadge, docHref, docNote, isOpen, linkTarget } from "@/lib/documents";
import { contentText } from "@/lib/content-i18n";
import { localePath, type Lang } from "@/lib/i18n";
import styles from "./page.module.css";

// Вкладка теперь ключ, а не её подпись: подпись есть на трёх языках,
// и сравнивать по ней панели значило бы переключать вкладки только на
// русской версии. Ключ один на все языки, подписи приходят из `ui(lang)`.
const ALL_TABS = ["specs", "kit", "documents", "service"] as const;
type Tab = (typeof ALL_TABS)[number];

// Вкладка «Комплектация» снята по просьбе заказчика после показа стенда
// (issue #83) — на всех четырёх карточках изделий набор вкладок общий,
// поэтому одна правка здесь убирает её везде. Панель ниже (JSX-ветка
// tab === "kit") нарочно оставлена в файле: заказчик может попросить
// вернуть вкладку, и тогда это одна строка — убрать её из HIDDEN_TABS, —
// а не восстановление текста заново.
const HIDDEN_TABS: readonly Tab[] = ["kit"];
const TABS = ALL_TABS.filter((t) => !HIDDEN_TABS.includes(t));

// Раньше здесь стоял список из трёх строк, набранный руками: «Описание
// изделия», «Регистрационное удостоверение», «Каталог продукции 2026» —
// одинаковый на каждой карточке и ведущий на форму независимо от того,
// что лежит в перечне портала. Это нарушало сразу два правила: карточка
// утверждала наличие документов, которых у изделия может не быть, и не
// показывала файл, когда он есть.
//
// Теперь перечень приходит из портала (issue #73). Правило ссылки — общее
// с /documents/, оно в lib/documents.
//
// Названия документов и приписки о том, как их получить, — утверждения
// о разрешительных документах: перевод им согласовывает заказчик, а до тех
// пор показывается русский оригинал.

// Ключ вкладки и есть её id: латиница без пробелов, одинаковая на всех
// языках. Раньше здесь стоял индекс в TABS — подписи были кириллицей
// с пробелами и в id не годились. Со стабильными ключами индекс стал лишним
// звеном: он ещё и менялся бы при скрытии вкладки, а id элемента, на который
// ссылается aria-labelledby, меняться не должен.
const tabId = (t: Tab) => `product-tab-${t}`;
const panelId = "product-tabpanel";

export default function ProductTabs({
  product,
  documents,
  lang,
}: {
  product: Product;
  /** Документы этого изделия. Отбор делает страница — см. lib/documents.forProduct. */
  documents: Doc[];
  lang: Lang;
}) {
  const [tab, setTab] = useState<Tab>("specs");
  const strings = ui(lang);
  const c = contentText(lang);
  const at = (path: string) => localePath(lang, path);

  return (
    <>
      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            id={tabId(t)}
            type="button"
            role="tab"
            aria-selected={tab === t}
            aria-controls={panelId}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {strings.product.tabs[t]}
          </button>
        ))}
      </div>

      <section
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(tab)}
        className={styles.panel}
      >
        {tab === "specs" &&
          (product.specs ? (
            <>
              <h2 className={styles.panelTitle}>{strings.product.tabs.specs}</h2>
              <div className={styles.specs}>
                {/* Строки характеристик — из датащитов производителя.
                    Переводим не мы: цифра с единицей измерения безобидна,
                    а её подпись — уже формулировка из документа. */}
                {product.specs.map((s) => (
                  <div key={s.label} className={styles.spec} lang={c.mark(s.label, s.value)}>
                    <span className={styles.specLabel}>{c.t(s.label)}</span>
                    <span className={s.muted ? styles.specMuted : undefined}>{c.t(s.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className={styles.panelTitle}>{strings.product.tabs.specs}</h2>
              {/* Абзац говорит о состоянии датащита — это утверждение
                  о документации, а не подпись интерфейса. */}
              <p className={styles.awaiting} lang={c.mark(SPECS_AWAITING)}>
                {c.t(SPECS_AWAITING)}
              </p>
            </>
          ))}

        {tab === "kit" && (
          <>
            <h2 className={styles.panelTitle}>{strings.product.tabs.kit}</h2>
            <p className={styles.awaiting} lang={c.mark(KIT_AWAITING)}>
              {c.t(KIT_AWAITING)}
            </p>
          </>
        )}

        {tab === "documents" && (
          <>
            <h2 className={styles.panelTitle}>{strings.product.documentsTitle}</h2>

            {documents.length === 0 ? (
              // Пустая вкладка честнее выдуманного списка: у изделия может
              // не быть ни одной строки в перечне, и рисовать кнопку под
              // документ, которого нет, нельзя. Сам абзац утверждает, как
              // выдают документацию, — значит, содержание, а не интерфейс.
              <p className={styles.awaiting} lang={c.mark(DOCS_EMPTY)}>
                {c.t(DOCS_EMPTY)}
              </p>
            ) : (
              <ul className={styles.docs}>
                {documents.map((d) => (
                  <li key={d.slug || d.title}>
                    {/* Куда ведёт строка и что говорит бейдж — решает
                        lib/documents, то же правило работает в перечне
                        на /documents/. Языковой префикс дописывается здесь:
                        правило про документ про языки не знает. */}
                    <Link
                      className={styles.doc}
                      href={docHref(d, at(REQUEST_HREF))}
                      {...linkTarget(d)}
                    >
                      <span
                        className={`${styles.docKind} ${
                          isOpen(d) ? styles.docKindOpen : styles.docKindMuted
                        }`}
                        lang={c.mark(accessBadge(d))}
                      >
                        {c.t(accessBadge(d))}
                      </span>
                      {/* Название документа и подпись под ним — утверждения
                          о разрешительных документах: перевод согласовывает
                          заказчик, до тех пор стоит русский оригинал. */}
                      <span className={styles.docBody} lang={c.mark(d.title, docNote(d))}>
                        <span className={styles.docTitle}>{c.t(d.title)}</span>
                        <span className={styles.docNote}>{c.t(docNote(d))}</span>
                      </span>
                      <span className={styles.docArrow} aria-hidden="true">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {/* Документы компании — лицензия, сертификат системы качества,
                каталог — к изделию не привязаны и живут в общем перечне.
                Ссылка ведёт туда, а не подмешивает их в список изделия. */}
            <p className={styles.docsAll}>
              <Link href={at("/documents/")}>{strings.product.allDocuments}</Link>
              {" · "}
              {strings.product.notInListing}{" "}
              <Link href={at(REQUEST_HREF)}>{strings.product.requestIt}</Link>
            </p>
          </>
        )}

        {tab === "service" && (
          <>
            <h2 className={styles.panelTitle}>{strings.product.tabs.service}</h2>
            <div className={styles.service}>
              {/* Что именно входит в сервис и когда отвечает инженер —
                  обязательство компании, а не подпись кнопки: сроки ответа
                  правила контента запрещают формулировать за заказчика. */}
              <p className={styles.serviceTitle} lang={c.mark(SERVICE_TITLE)}>
                {c.t(SERVICE_TITLE)}
              </p>
              <p className={styles.serviceText} lang={c.mark(SERVICE_TEXT)}>
                {c.t(SERVICE_TEXT)}
              </p>
              <Link className={styles.serviceBtn} href={at("/service/")}>
                {strings.actions.serviceRequest}
              </Link>
            </div>
          </>
        )}
      </section>
    </>
  );
}

// Абзацы вынесены в константы ради словаря переводов: его ключ — сам русский
// оригинал (см. lib/content-i18n.ts), и текст, размазанный по JSX переносами
// строк, пришлось бы переносить в словарь посимвольно.

/** У изделия нет ни одной строки в перечне: что это значит и что делать. */
const DOCS_EMPTY =
  "В перечне документов пока нет ни одной строки об этом изделии. Документация выдаётся по запросу — укажите модель в заявке, специалист пришлёт актуальную редакцию.";
/** Датащит ещё не передан: почему характеристик нет и как их получить. */
const SPECS_AWAITING =
  "Технические характеристики этой позиции выдаются по запросу — датащит ещё не передан для публикации. Укажите модель в заявке, специалист пришлёт документацию.";

/** Состав поставки согласуется под задачу отделения. */
const KIT_AWAITING =
  "Состав поставки и опции согласуются под задачу отделения. Базовая комплектация и перечень опций — ожидает уточнения.";

/** Заголовок карточки сервиса. */
const SERVICE_TITLE = "Сервис и обучение персонала";

/** Что входит в сервис и когда отвечает инженер. */
const SERVICE_TEXT =
  "Монтаж, настройка и обучение — по заявке. Сервисный инженер отвечает в рабочие часы.";
