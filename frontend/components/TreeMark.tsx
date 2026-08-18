import Image from "next/image";
import { treeMark } from "@/content/brand";
import styles from "./TreeMark.module.css";

/**
 * Маркировочный знак-дерево. §11.2 плана.
 *
 * Пока заказчик не передал файл, компонент не рисует ничего — ни рамки,
 * ни подписи «здесь будет знак». Пустая заглушка на публичной странице
 * выглядит как недоделка, а не как ожидание материала, и объяснять её
 * пришлось бы каждому, кто откроет стенд.
 *
 * Место при этом уже занято в разметке обеих страниц, и включение знака —
 * это одно значение в content/brand.ts, а не поиск, куда его вставить.
 */
export default function TreeMark({ where }: { where: "about" | "production" }) {
  if (!treeMark.available) return null;

  const copy = treeMark[where];

  return (
    <aside className={styles.mark}>
      <div className={styles.image}>
        <Image src={treeMark.src} alt={treeMark.alt} fill sizes="96px" />
      </div>
      <div>
        <p className={styles.title}>{copy.title}</p>
        <p className={styles.text}>{copy.text}</p>
      </div>
    </aside>
  );
}
