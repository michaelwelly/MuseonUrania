import type { Metadata } from "next";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import { newsHero, press } from "@/content/news";
import { pressContact, DEMO_NOTE } from "@/content/staff";
import { fetchNews } from "@/lib/api";
import NewsFeed from "./feed";
import NewsSubscribe from "./subscribe";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Новости и пресс-центр — VEDAL",
  description: newsHero.lead,
};

export default async function NewsPage() {
  const news = await fetchNews();

  return (
    <main className={styles.page}>
      <PageHero
        crumbs={[{ label: "Главная", href: "/" }, { label: "Новости" }]}
        title={newsHero.title}
        lead={newsHero.lead}
      />

      <NewsFeed news={news} />

      <section className={styles.press}>
        <div data-reveal="0">
          <p className={styles.eyebrow}>{press.eyebrow}</p>
          <h2 className={styles.h2} data-words="30">
            {press.title}
          </h2>
          <p className={styles.pressText}>{press.text}</p>

          <div className={styles.contact}>
            <div className={styles.avatar}>
              <Image src="/urania/urania-avatar-middle-v1.png" alt="" fill sizes="56px" />
            </div>
            <div>
              <p className={styles.contactName}>{pressContact.name}</p>
              <p className={styles.contactRole}>
                {pressContact.role} ·{" "}
                <a href={`mailto:${pressContact.email}`}>{pressContact.email}</a>
              </p>
            </div>
          </div>
          {/* Пресс-контакт — заглушка из макета, см. content/staff.ts */}
          <p className={styles.demoNote}>{DEMO_NOTE}</p>
        </div>

        <NewsSubscribe />
      </section>
    </main>
  );
}
