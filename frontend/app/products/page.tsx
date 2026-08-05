import type { Metadata } from "next";
import Link from "next/link";
import { hero, headerCta, urania } from "@/content/site";
import { products } from "@/content/products";
import Catalog from "./catalog";
import styles from "./page.module.css";

const confirmed = products.filter((p) => p.status === "confirmed").length;

export const metadata: Metadata = {
  title: "Продукция — VEDAL",
  description:
    "Оборудование VEDAL для неонатологии, реанимации, анестезиологии, мониторинга и интенсивной терапии.",
};

export default function ProductsPage() {
  return (
    <main className={styles.page}>
      <section className={styles.section}>
        <p className={styles.eyebrow}>Продукция</p>
        <h1 className={styles.h1}>Оборудование для неонатологии и интенсивной терапии</h1>
        <p className={styles.lead}>
          Выберите категорию или откройте карточку изделия. По {confirmed} позициям
          описание приведено по документации производителя, остальные позиции
          уточняются — характеристики появятся после согласования.
        </p>
      </section>

      <section className={styles.section}>
        <Catalog />
      </section>

      <section className={styles.section}>
        <div className={styles.assistant}>
          <div>
            <h2 className={styles.h2}>Не знаете, что подойдёт под задачу?</h2>
            <p className={styles.lead}>
              {urania.name} задаст уточняющие вопросы и подскажет категорию, а сложный
              запрос передаст специалисту.
            </p>
          </div>
          <div className={styles.actions}>
            {/* Панели чата ещё нет, поэтому ведём к карточке ассистента на главной. */}
            <Link
              className={`${styles.button} ${styles.secondary}`}
              href="/#urania"
              data-analytics="urania_quick_action_click"
            >
              Подобрать оборудование
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.assistant}>
          <div>
            <h2 className={styles.h2}>Запросите коммерческое предложение</h2>
            <p className={styles.lead}>
              Укажите позиции и объём — специалист подготовит предложение и ответит
              на вопросы по комплектации.
            </p>
          </div>
          <div className={styles.actions}>
            <a
              className={`${styles.button} ${styles.primary}`}
              href={hero.primaryCta.href}
              data-analytics="quote_form_submit"
            >
              {hero.primaryCta.label}
            </a>
            <a
              className={`${styles.button} ${styles.secondary}`}
              href={headerCta.href}
              data-analytics="header_contact_click"
            >
              {headerCta.label}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
