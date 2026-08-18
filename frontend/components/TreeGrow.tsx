import Image from "next/image";
import { treeMark } from "@/content/brand";
import styles from "./TreeGrow.module.css";

/**
 * Знак-дерево, который прорастает снизу вверх. Загрузочный экран.
 *
 * Приём взят из самого знака, а не придуман к нему: крона дерева сложена
 * из тех же скруглённых крестиков, что и фирменный знак VEDAL. Поэтому
 * дерево не «появляется» и не крутится — оно растёт, и крона набирается
 * крестиками по мере роста. Движение объясняет, из чего знак сделан.
 *
 * Рост сделан маской, а не обрезкой контейнера: у маски мягкий край,
 * и граница появления не читается прямой линией, ползущей по картинке.
 */
export default function TreeGrow({ size = 176 }: { size?: number }) {
  return (
    <div className={styles.wrap} style={{ width: size, height: size }} aria-hidden="true">
      <Image src={treeMark.src} alt="" fill sizes={`${size}px`} priority className={styles.tree} />
    </div>
  );
}
