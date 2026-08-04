import Image from "next/image";
import { urania, URANIA_AVATAR } from "@/content/site";
import styles from "./UraniaCard.module.css";

// Карточка ассистента на первом экране — docs/frontend/sitemap.md → Urania Placement.
// Аватар urania-avatar-middle-v1.png утверждён как MVP-вариант
// (docs/strategy/urania_visual_assets.md → Recommended Choice).
// Быстрые действия ведут на MVP-маршруты, чат-ввод отключён до появления бэкенда.
export default function UraniaCard() {
  return (
    <aside className={styles.card} aria-label={`Ассистент ${urania.name}`}>
      <div className={styles.head}>
        <Image
          className={styles.avatar}
          src={URANIA_AVATAR}
          alt={`Аватар ассистента ${urania.name}`}
          width={72}
          height={72}
          priority
        />
        <div>
          <div className={styles.name}>{urania.name}</div>
          <div className={styles.role}>{urania.role}</div>
        </div>
      </div>

      <p className={styles.message}>{urania.greeting}</p>

      <div className={styles.quick}>
        {urania.quickActions.map((action) => (
          <a
            key={action.label}
            href={action.href}
            data-analytics="urania_quick_action_click"
          >
            {action.label}
          </a>
        ))}
      </div>

      <div className={styles.input}>
        <input
          type="text"
          placeholder={urania.inputPlaceholder}
          aria-label={`Вопрос ассистенту ${urania.name}`}
          disabled
          title="Чат-ассистент ожидает подключения"
        />
        <button
          type="button"
          className={styles.send}
          disabled
          aria-label="Отправить вопрос"
          title="Чат-ассистент ожидает подключения"
        >
          ›
        </button>
      </div>
    </aside>
  );
}
