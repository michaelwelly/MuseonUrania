# Визуальные материалы Ведалины

**Русский** · [English](vedalina_visual_assets.en.md)

## Сгенерированные материалы

В репозитории:

- `assets/vedalina/vedalina-avatar-concepts-v1.png`
- `assets/vedalina/vedalina-avatar-left-v1.png`
- `assets/vedalina/vedalina-avatar-middle-v1.png`
- `assets/vedalina/vedalina-avatar-right-v1.png`
- `assets/vedalina/vedalina-web-integration-mockup-v1.png`

Прототип:

- `prototypes/vedalina-web-interface.html`

## Рекомендованный выбор

Взять `vedalina-avatar-middle-v1.png` как направление аватара для MVP.

Почему:

- спокойный, похож на ассистента;
- не слишком клинический;
- не перегружен фэнтези;
- хорошо смотрится в маленьком круглом веб-виджете.

Альтернативы:

- `vedalina-avatar-left-v1.png` — более медицинский и клинический, если НН хочет,
  чтобы ассистент был ближе к предметной области оборудования;
- `vedalina-avatar-right-v1.png` — более небесный, ближе к образу музы, если НН
  хочет, чтобы мифология Ведалины была заметнее.

## Интеграция в сайт

Ведалина должна появляться в двух местах:

1. Карточка ассистента на первом экране, вторичная по отношению к главному
   заголовку о продукции и производстве.
2. Плавающая кнопка ассистента в правом нижнем углу после прокрутки.

Быстрые действия:

- Подобрать оборудование
- Найти документ
- Запросить КП
- Сервис

Важное ограничение:

Сгенерированный веб-макет — только визуальное направление. Финальный интерфейс
должен быть пересобран в коде с точными согласованными текстами, без артефактов
сгенерированного текста и без несогласованных заявлений.

## Запись промптов

Промпт концепта аватара:

```text
Create a clean concept sheet with 3 circular avatar variants for an AI website assistant named Vedalina, inspired by the Greek muse of astronomy. Calm female AI guide, precise and expert, not a doctor, not fantasy-heavy. Subtle celestial motifs: star map lines, celestial globe, compass, orbit arcs. Polished semi-flat / soft 3D illustration, vector-friendly, suitable for small web avatars. Palette: VEDAL green, teal, white, charcoal, small muted gold accent. No words, no watermark, no logos, no medical cross, no stethoscope, no mystical fortune-teller look.
```

Промпт макета веб-интеграции:

```text
Create a conservative desktop web interface mockup showing how the Vedalina assistant integrates into the first screen of vedal-med.ru. Hero section with VEDAL-style green accents, headline area, two CTA buttons, and a right/lower-right assistant widget named Vedalina with circular avatar, compact chat card, and quick actions. Russian UI text: "Российское медицинское оборудование", "Запросить КП", "Каталог", "Vedalina: помогу найти продукт или документ". No prices, no clinical advice, no invented certifications.
```
