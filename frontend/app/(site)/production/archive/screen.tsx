import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { mediaSrc } from "@/lib/media";
import { JsonLd, breadcrumbStructuredData } from "@/lib/structured-data";
import { site } from "@/content/site";
import { photoArchive } from "@/content/photo-archive";
import { ui as strings } from "@/content/ui";
import styles from "./page.module.css";

// Фотоархив производства — все кадры съёмки 2 сентября (content/photo-archive.ts).
//
// Сетка в колонках, а не в строках: кадры бывают горизонтальные и
// вертикальные, и в колонках каждый стоит в своих пропорциях без обрезки.
// Размеры у Image заданы честно — место под снимок занято до загрузки,
// страница из 155 кадров не прыгает при прокрутке.
//
// Загрузка ленивая (по умолчанию у next/image): браузер берёт превью, когда
// до него доходит прокрутка. Первые кадры грузятся сразу — они на экране.

export function archiveMetadata(): Metadata {
  return pageMetadata({
    title: `${photoArchive.title} — VEDAL`,
    description: photoArchive.lead,
    path: "/production/archive/",
  });
}

const EAGER = 6;

export default function ArchiveScreen() {
  const total = photoArchive.shots.length;
  return (
    <main className={styles.page}>
      <JsonLd
        id="breadcrumb-jsonld-production-archive"
        data={breadcrumbStructuredData(
          [
            { label: strings.crumbs.home, href: "/" },
            { label: strings.crumbs.production, href: "/production/" },
            { label: photoArchive.title },
          ],
          "/production/archive/",
        )}
      />
      <header className={styles.head}>
        <p className={styles.crumbs}>
          <Link href="/">{strings.crumbs.home}</Link> /{" "}
          <Link href="/production/">{strings.crumbs.production}</Link> / {photoArchive.title}
        </p>
        <h1 className={styles.title}>{photoArchive.title}</h1>
        <p className={styles.lead}>{photoArchive.lead}</p>
        <p className={styles.meta}>
          {total} снимков · {photoArchive.hint}
        </p>
      </header>

      <ul className={styles.grid}>
        {photoArchive.shots.map((shot, i) => (
          <li key={shot.name} className={styles.item}>
            {/* Оригинал открывается в новой вкладке: это файл, а не страница,
                и возврат к месту в сетке из 155 кадров иначе терялся бы. */}
            <a href={mediaSrc(shot.original)} target="_blank" rel="noopener noreferrer">
              <Image
                src={mediaSrc(shot.preview)}
                alt={`Производство VEDAL, снимок ${i + 1} из ${total}`}
                width={shot.width}
                height={shot.height}
                sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
                loading={i < EAGER ? "eager" : "lazy"}
              />
              <span className={styles.srOnly}> (оригинал откроется в новой вкладке)</span>
            </a>
          </li>
        ))}
      </ul>

      <footer className={styles.foot}>
        <p>{photoArchive.credit}</p>
        <p>
          {photoArchive.rights} <a href={`mailto:${site.email}`}>{site.email}</a>
        </p>
        <p className={styles.back}>
          <Link href="/production/">← {strings.crumbs.production}</Link>
        </p>
      </footer>
    </main>
  );
}
