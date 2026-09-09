import Link from "next/link";

import { site } from "@/content/site";
import { ui as strings } from "@/content/ui";
import styles from "./not-found.module.css";

// Страница «не найдено» для публичного сайта. GitHub issue #104.
//
// До неё было два разных плохих исхода, и оба видел посетитель, пришедший
// по устаревшей ссылке или с опечаткой в адресе:
//
// — неизвестный слаг изделия (`notFound()` из карточки) отдавал разметку
//   `<html id="__next_error__">` с ПУСТЫМ body — белый экран без единой
//   ссылки обратно;
// — несуществующий адрес отдавал встроенную заглушку Next
//   «404 · This page could not be found.» — по-английски, без шапки
//   и подвала.
//
// Этот файл закрывает первый случай для всех страниц группы `(site)`:
// карточки изделия, новости и всего, что зовёт `notFound()`. Второй
// случай — несопоставленный адрес — ловит перехватывающий маршрут
// `[...notFound]/page.tsx` рядом: он тоже зовёт `notFound()` и потому
// приводит сюда же. Отдельная страница на каждый случай разошлась бы.
//
// Текст ничего не додумывает. «Изделие снято с производства» или «документ
// отозван» здесь написать нельзя: сайт не знает, почему адреса нет, а
// правила контента запрещают правдоподобную выдумку. Названы обе настоящие
// причины — опечатка и переезд страницы.
//
// ————— что осталось несделанным —————
//
// Next 16 отдаёт ответ `notFound()` документом `<html id="__next_error__">`
// с пустым body: сама страница приезжает в потоке RSC и собирается уже
// в браузере. Проверено на стенде — в браузере страница видна целиком,
// код ответа 404, `robots: noindex` на месте; без JS видно пустой экран.
//
// Разбирались: вложенный `not-found.tsx` глубже по дереву ведёт себя так же,
// значит дело не в двух корневых layout'ах, а в том, как Next рисует границу
// «не найдено» вообще. Городить обход — отдельный маршрут, который рисует
// то же самое обычной страницей, — значит потерять код 404: поставить его
// без `notFound()` неоткуда, а 200 на несуществующем адресе хуже пустого
// body для тех немногих, у кого выключен JS.

/**
 * Разделы, куда осмысленно уйти с несуществующего адреса.
 *
 * Не весь список из шапки: она и так стоит выше на этой же странице.
 * Здесь четыре входа, за которыми люди приходят на сайт, — каталог,
 * документы, сервис и контакты.
 */
const DESTINATIONS = ["/products/", "/documents/", "/service/", "/contacts/"] as const;

export default function NotFound() {
  const label: Record<(typeof DESTINATIONS)[number], string> = {
    "/products/": strings.crumbs.products,
    "/documents/": strings.crumbs.documents,
    "/service/": strings.crumbs.service,
    "/contacts/": strings.crumbs.contacts,
  };

  return (
    <main className={styles.page}>
      <p className={styles.code}>404</p>
      <h1 className={styles.title}>{strings.notFound.title}</h1>
      <p className={styles.text}>{strings.notFound.text}</p>

      <p className={styles.linksTitle}>{strings.notFound.linksTitle}</p>
      <ul className={styles.links}>
        <li>
          <Link className={styles.link} href="/">
            {strings.crumbs.home}
          </Link>
        </li>
        {DESTINATIONS.map((path) => (
          <li key={path}>
            <Link className={styles.link} href={path}>
              {label[path]}
            </Link>
          </li>
        ))}
      </ul>

      <p className={styles.report}>
        {strings.notFound.reportText}{" "}
        <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>,{" "}
        <a href={`mailto:${site.email}`}>{site.email}</a>
      </p>
    </main>
  );
}
