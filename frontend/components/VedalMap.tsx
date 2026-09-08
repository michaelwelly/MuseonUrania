import { site } from "@/content/site";
import styles from "./VedalMap.module.css";

// Схема проезда без внешних сервисов: чистый CSS, без картинок и SVG.
//
// GitHub issue #74, второй заход (7–8 сентября): заказчик попросил
// пересмотреть развилку "живая карта или без кнопки". Проверили оба пути
// живой карты снова:
//   - Static API Яндекса (картинка вместо этого блока) — нужен apikey,
//     в backend/.env его нет, выдумывать нельзя;
//   - iframe map-widget (https://yandex.ru/map-widget/v1/…) — ключ не
//     нужен, но это сторонний скрипт и cookie третьей стороны на странице,
//     а баннера согласия на сайте всё ещё нет (issue #53 открыт). Ставить
//     трекинг стороннего сервиса до баннера на сайте медицинского
//     производителя — риск больше, чем польза от кнопки.
// Поэтому схема остаётся статичной. Изменилась только кнопка «Построить
// маршрут» на странице контактов — теперь у неё рабочая ссылка на
// Яндекс.Карты по адресу (без ключа и без стороннего скрипта на самой
// странице), см. content/contacts.ts → route.ctaHref.
export default function VedalMap() {
  return (
    <div className={styles.map} role="img" aria-label={`Схема проезда: ${site.address}`}>
      <div className={styles.grid} />

      <div className={`${styles.block} ${styles.block1}`} />
      <div className={`${styles.block} ${styles.block2}`} />
      <div className={`${styles.block} ${styles.block3}`} />
      <div className={`${styles.block} ${styles.block4}`} />
      <div className={`${styles.block} ${styles.round}`} />

      <div className={styles.roadH} />
      <div className={styles.roadDash} />
      <div className={styles.roadDiag} />
      <div className={styles.roadBottom} />

      <span className={`${styles.street} ${styles.streetA}`}>ул. Совхозная</span>
      <span className={`${styles.street} ${styles.streetB}`}>пер. Промышленный</span>

      <div className={styles.marker}>
        <div className={styles.plate}>
          <span className={styles.cross} aria-hidden="true">
            +
          </span>
          <span>
            <span className={styles.plateName}>{site.legalName}</span>
            <span className={styles.plateNote}>ул. Совхозная, стр. 20В · производство</span>
          </span>
        </div>
        <span className={styles.pin} aria-hidden="true">
          <span className={styles.ping} />
          <span className={styles.dot} />
        </span>
      </div>

      <div className={styles.zoom} aria-hidden="true">
        <span>+</span>
        <span>−</span>
      </div>

      <div className={styles.legend}>
        <span className={styles.legendDot} aria-hidden="true" />
        Схема проезда · Екатеринбург, 620135
      </div>
    </div>
  );
}
