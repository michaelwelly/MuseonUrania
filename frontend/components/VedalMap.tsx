import { site } from "@/content/site";
import styles from "./VedalMap.module.css";

// Схема проезда без внешних сервисов: чистый CSS, без картинок и SVG.
// Подключать Яндекс/Google не нужно — решение заказчика.
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
