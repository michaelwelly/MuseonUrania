# Frontend Sitemap

[Русский](sitemap.md) · **English**

## Purpose

This sitemap defines the first website release structure for `vedal-med.ru`.

Primary goal: turn the current public website into a practical B2B sales and information interface for VEDAL medical equipment.

## Global Navigation

Recommended top-level navigation:

1. Главная
2. Продукция
3. Производство
4. Документы
5. Новости
6. Сервис
7. Контакты

There is no press centre and no partners page in the navigation — the reason
is in "First Release Routes" below.

Persistent elements:

- VEDAL logo.
- Phone number.
- Search icon.
- CTA: `Запросить КП`.
- Vedalina floating assistant button.

## First Release Routes

| Route | Page | Status | Purpose |
| --- | --- | --- | --- |
| `/` | Главная | MVP | production/product positioning, hero, Vedalina slot, product categories, trust, CTA |
| `/products/` | Продукция | MVP | catalog overview, product cards, filters, quote/catalog requests |
| `/products/<slug>/` | Product detail | MVP | individual product page with specs, docs, media, CTA |
| `/production/` | Производство | MVP | production story, quality system, approved photos |
| `/documents/` | Документы | MVP | approved public certificates, catalog, brochures |
| `/news/` | Новости | done | news feed, including the Innoprom release |
| `/news/<slug>/` | News entry | done | a single article |
| `/about/` | О компании | done | who we are, in-house R&D, Ural Chamber of Commerce membership |
| `/service/` | Сервис | MVP | service request and support routing |
| `/contacts/` | Контакты | MVP | contact details and forms |
| `/legal/privacy/` | Политика приватности | done | personal data handling, consent used by the forms |

There is no press centre and no partners page in the code, and that is not
an omission.

`/press/` became `/news/`: for a visitor a press centre and a news feed are
the same thing, and two sections with the same content would have to be filled
twice. The Innoprom release will be an article in the feed, not a route
of its own.

`/partners/` is deliberately absent: naming a company as a partner in public
is a statement about them, not about us, and it needs their consent. After the
meeting with the customer the partners block was removed from the home page;
Ural Chamber of Commerce membership stands in its place.

The discrepancy had lived since the frontend began and became visible together
with `sitemap.xml`: the crawler-facing map is built from actual routes, and
promising there what the portal does not serve means sending crawlers to a 404.

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
   - Vedalina assistant card/slot.
3. Product categories.
4. Priority products.
5. Production and quality block.
6. Documents/certification teaser.
7. News/Innoprom block.
8. Ural Chamber of Commerce membership.
9. Lead capture block.
10. Footer.

## Vedalina Placement

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

- a mention in the footer rather than a block of its own on Home.
- short explanation on the About page.
- internal architecture roadmap, not headline brand.

## SEO Route Notes

Priority SEO pages:

- `/products/`
- `/products/<slug>/`
- `/production/`
- `/documents/`
- `/news/` and its articles, including the Innoprom release.

No SEO page should publish unapproved certification, clinical, price, availability, or delivery claims.
