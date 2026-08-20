# Claude Context Bundle

[Русский](claude_context_bundle.md) · **English**

Use this as a single-file context bundle when asking Claude to generate frontend variants.

## Project

VEDAL public website redesign for `vedal-med.ru`.

VEDAL is a Russian medical equipment manufacturer. The first release should be a conservative B2B website that informs, supports product discovery, and captures quote/catalog/service requests.

## Immediate Goal

Generate three frontend variants:

1. Conservative Manufacturer.
2. Product-Led Catalog.
3. Expert Technology Platform.

Then recommend one variant for NN review.

## Required Pages

- Home
- Products
- Product detail
- Production
- Documents
- Press center
- Partners
- Service
- Contacts

## Hero Requirements

The home/title screen must be redesigned.

Mandatory hero elements:

- VEDAL as the primary brand.
- headline about Russian medical equipment production.
- support text for neonatology, resuscitation, anesthesia, intensive therapy.
- primary CTA: `Запросить КП`.
- secondary CTA: `Каталог`.
- production/product visual.
- Vedalina assistant card/slot.
- no unapproved medical, price, certification, delivery, or technical claims.

## Vedalina

Vedalina is the public website assistant.

Visual idea:

- inspired by Vedalina, muse of astronomy;
- calm female expert guide;
- celestial globe, compass, star map, subtle orbit lines;
- green/teal/white/charcoal palette;
- precise and restrained, not fantasy-heavy.

Use recommended MVP asset:

- `assets/vedalina/vedalina-avatar-middle-v1.png`

Other available references:

- `assets/vedalina/vedalina-avatar-concepts-v1.png`
- `assets/vedalina/vedalina-avatar-left-v1.png`
- `assets/vedalina/vedalina-avatar-right-v1.png`
- `assets/vedalina/vedalina-web-integration-mockup-v1.png`
- `prototypes/vedalina-web-interface.html`

Vedalina quick actions:

- Подобрать оборудование
- Найти документ
- Запросить КП
- Сервис

Vedalina safety limits:

- no diagnosis;
- no treatment advice;
- no invented specifications;
- no invented certificates;
- no prices;
- no delivery promises;
- no private documents;
- route uncertainty to a human specialist.

## Smart Solution

Smart Solution is a secondary technology integration layer, not the primary public brand.

Role:

- website forms to CRM;
- S3/document metadata;
- future AI search;
- assistant and analytics roadmap.

Do not make Smart Solution visually stronger than VEDAL.

## Content Rules

Use placeholders when data is missing:

- `ожидает уточнения`
- `awaiting NN answer`

Do not invent:

- product specs;
- certification status;
- ISO claims;
- registration certificates;
- prices;
- availability;
- delivery times;
- clinical claims.

## Sitemap

Top navigation:

- Главная
- Продукция
- Производство
- Документы
- Пресс-центр
- Партнёры
- Сервис
- Контакты

MVP routes:

- `/`
- `/products/`
- `/products/<slug>/`
- `/production/`
- `/documents/`
- `/press/`
- `/partners/`
- `/service/`
- `/contacts/`

## Product Categories

Use these as draft filters:

- Неонатология
- Реанимация
- Анестезиология
- Мониторинг
- Интенсивная терапия

## Deliverables Expected From Claude

For each of the three variants:

1. Design rationale.
2. Home page section layout.
3. Products page layout.
4. Product detail layout.
5. Vedalina assistant UI state.
6. Mobile behavior.
7. Risks and what NN must confirm.

Then provide:

- recommended variant for first NN review;
- list of implementation components;
- list of remaining content placeholders.

## Evaluation Criteria

The best variant should:

- feel conservative and credible;
- make product discovery easy;
- show production and documents clearly;
- preserve VEDAL as the main brand;
- include Vedalina visibly but secondarily;
- prepare CRM/S3/AI integration without overpromising;
- be realistic to implement quickly.
