# Frontend

**Русский** · [English](README.en.md)

Публичный сайт `vedal-med.ru` и ассистент Urania. Next.js 16, App Router, TypeScript, CSS Modules.

## Запуск

```bash
npm run dev
```

## Что сделано

Первый экран главной: шапка, hero, карточка Urania, плавающая кнопка ассистента.
Источник вёрстки — [prototypes/urania-web-interface.html](../prototypes/urania-web-interface.html),
требования — [docs/frontend](../docs/frontend).

## Структура

- `app/` — маршруты и глобальные стили.
- `components/` — шапка и блоки ассистента.
- `content/site.ts` — весь текст страницы. Незаполненные факты помечены `AWAITING`.

## Правила контента

Не выдумывать цены, характеристики, сертификаты и клинические заявления
([HANDOFF.md](../HANDOFF.md)). Недостающие данные — `ожидает уточнения` в `content/site.ts`.

Работа ведётся в ветке `front`.
