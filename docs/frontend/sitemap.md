# Frontend Sitemap

## Purpose

This sitemap defines the first website release structure for `vedal-med.ru`.

Primary goal: turn the current public website into a practical B2B sales and information interface for VEDAL medical equipment.

## Global Navigation

Recommended top-level navigation:

1. Главная
2. Продукция
3. Производство
4. Документы
5. Пресс-центр
6. Партнёры
7. Сервис
8. Контакты

Persistent elements:

- VEDAL logo.
- Phone number.
- Search icon.
- CTA: `Запросить КП`.
- Urania floating assistant button.

## First Release Routes

| Route | Page | Status | Purpose |
| --- | --- | --- | --- |
| `/` | Главная | MVP | production/product positioning, hero, Urania slot, product categories, trust, CTA |
| `/products/` | Продукция | MVP | catalog overview, product cards, filters, quote/catalog requests |
| `/products/<slug>/` | Product detail | MVP | individual product page with specs, docs, media, CTA |
| `/production/` | Производство | MVP | production story, quality system, approved photos |
| `/documents/` | Документы | MVP | approved public certificates, catalog, brochures |
| `/press/` | Пресс-центр | MVP | Innoprom release and news |
| `/partners/` | Партнёры | MVP | Divisy, Morus MS, Smart Solution role |
| `/service/` | Сервис | MVP | service request and support routing |
| `/contacts/` | Контакты | MVP | contact details and forms |

## Later Routes

| Route | Page | Reason To Defer |
| --- | --- | --- |
| `/technology/` | Разработка и технологии | needs careful approval of R&D and claims |
| `/cases/` | Кейсы | needs customer/project approval |
| `/en/` | English version | after Russian content approval |
| `/zh/` | Chinese version | after Russian content approval |
| `/hi/` | Hindi version | later market-entry stage |
| `/knowledge/` | Internal knowledge portal | private contour, not public release |

## Home Page Structure

1. Header and navigation.
2. Hero/title section:
   - VEDAL production headline.
   - two CTAs: `Запросить КП`, `Каталог`.
   - visual evidence: real product/production image.
   - Urania assistant card/slot.
3. Product categories.
4. Priority products.
5. Production and quality block.
6. Documents/certification teaser.
7. Press/Innoprom block.
8. Partners and Smart Solution integration.
9. Lead capture block.
10. Footer.

## Urania Placement

First release should support:

- hero assistant card on desktop;
- floating button after scroll;
- compact mobile assistant button;
- quick actions:
  - Подобрать оборудование
  - Найти документ
  - Запросить КП
  - Сервис

## Smart Solution Placement

Smart Solution should appear as:

- technology integration partner;
- not stronger than VEDAL visually;
- connected to forms, CRM handoff, S3/document metadata, future AI search.

Recommended placement:

- partner/integration block on Home.
- short explanation on Partners page.
- internal architecture roadmap, not headline brand.

## SEO Route Notes

Priority SEO pages:

- `/products/`
- `/products/<slug>/`
- `/production/`
- `/documents/`
- `/press/innoprom/` if separate Innoprom article is approved.

No SEO page should publish unapproved certification, clinical, price, availability, or delivery claims.
