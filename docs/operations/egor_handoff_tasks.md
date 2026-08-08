# Egor Handoff Tasks

## Purpose

This document defines the current handoff for Egor and separates frontend delivery from backend/CMS and AI closed-contour work.

Egor owns UX/UI and frontend implementation. Mikhail owns backend/CMS, infrastructure, AI architecture, frontend architecture guardrails, and final integration acceptance.

## Working Agreement

- Egor writes the frontend using the approved visual direction and this repository as the source package.
- Mikhail provides architecture, API contracts, content structure, backend/CMS scope, and integration review.
- NN approves the structure and business wording from the customer side.
- Public medical-device claims, prices, certificates, and registration status must not be invented.
- Missing content is marked as `ожидает уточнения`.

## Start Package For Egor

- `HANDOFF.md`
- `docs/frontend/README.md`
- `docs/frontend/claude_context_bundle.md`
- `docs/frontend/sitemap.md`
- `docs/frontend/content_model.md`
- `docs/frontend/page_briefs.md`
- `docs/frontend/implementation_checklist.md`
- `docs/strategy/urania_assistant_spec.md`
- `docs/strategy/urania_visual_assets.md`
- `assets/urania/urania-avatar-middle-v1.png`
- `assets/urania/urania-web-integration-mockup-v1.png`

## Frontend Tasks For Egor

### P0: First Screen And Navigation

- Rebuild the title page from the approved PNG visual reference.
- Keep VEDAL as the primary brand and Smart Solution as a secondary integration layer.
- Add `Войти` button to the left of the VEDAL logo.
- Add `Новости` in the header between `Документы` and `Контакты`.
- Add `Сервис` near `Продукция`.
- Keep phone and primary contact CTA visible in desktop header.
- Prepare responsive mobile header.

### P0: Urania Public Assistant UI

- Use the second/middle Urania avatar variant.
- Add Urania card on the first screen.
- Add floating Urania button in the lower-right corner.
- Public mode label: `AI-поиск по открытым документам`.
- Quick actions:
  - `Подобрать оборудование`
  - `Найти документ`
  - `Запросить КП`
  - `Сервис и поддержка`
  - `Получить каталог`
- Public assistant UI must not imply medical diagnosis, treatment recommendations, or clinical decision support.

### P0: Core Pages

- Home/title page.
- Product catalog page.
- Product detail template.
- Service/warranty page.
- Documents page.
- News page with Innoprom release placeholder.
- Contacts page.

### P1: Forms

- Quote request form.
- Catalog request form.
- Service request form.
- Consultation/contact form.
- Partnership request form, if approved.
- Forms must be structured for backend/CRM handoff.
- Each form must include consent/privacy text before submission.

### P1: Content Structure

- Product cards support 10 products.
- Product data fields use placeholders until NN confirms the catalog.
- Documents display only public materials.
- News supports at least one Innoprom press release.
- Service page includes warranty/service conditions only after customer approval.

### P1: SEO And Analytics Readiness

- Page title, description, h1, canonical, OG fields.
- Structured URLs for products, documents, news, and service.
- Frontend event names aligned with `docs/frontend/implementation_checklist.md`.
- Prepare hooks for Yandex Metrica events.

### Acceptance Criteria For Egor

- Desktop and mobile layouts are stable.
- Header items do not wrap awkwardly.
- Urania is visible but does not overpower product/production message.
- Product/category cards do not shift layout when content is missing.
- All buttons have clear states.
- Forms have validation states and success/error states.
- No fake prices, certificates, clinical claims, or private documents.

## Backend / CMS Scope For Mikhail

### CMS/Admin

- Admin login and closed-contour access.
- Manage pages.
- Manage products.
- Manage documents.
- Manage news.
- Manage SEO metadata.
- Manage public/private visibility flags.
- Prepare editor roles and audit trail.

### API

- Swagger/OpenAPI contract.
- Public API for published site content.
- Forms API for quote/catalog/service/contact requests.
- Admin API for CMS operations.
- Assistant API for Urania public and authenticated modes.
- Health checks and basic monitoring endpoints.

### Storage

- S3-compatible storage.
- Public bucket/namespace for images, public documents, catalogs, and press materials.
- Private bucket/namespace for internal documentation.
- Metadata in database for document type, access scope, language, product relation, and publication status.

### Auth And Closed Contour

- Authentication for admin and employee access.
- Role-based access to internal pages/documents.
- Public website separated from admin, internal documents, and AI search.
- Store personal data and business data in Russian Federation infrastructure.

### CRM Handoff

- Lead model for quote requests, catalog requests, consultation requests, service requests, and partner requests.
- Email notification fallback.
- Export/integration-ready payload for future CRM.
- UTM/source fields for advertising and analytics.

## AI / Closed-Contour Scope For Mikhail

### Public Urania

- Public Urania answers only from approved public pages and public documents.
- It can navigate products, documents, service, and commercial next steps.
- It routes requests to forms or human specialists when confidence is low.
- It must provide source links where possible.

### Authenticated Urania

- After login, Urania can search internal documents and databases.
- Answers are filtered by user role and document permissions.
- Internal answers must not leak into public mode.
- All internal AI interactions should be auditable.

### Document Processing

- Classify documents as `public`, `internal`, `confidential`, `service`, `production`, or `R&D`.
- Extract text from documents.
- Split into chunks with metadata.
- Create embeddings.
- Store/search via PostgreSQL + pgvector or equivalent approved stack.
- Preserve links to source documents and versions.

### Hard Safety Rules

- No diagnosis.
- No treatment recommendations.
- No invented prices.
- No invented certificates or registration status.
- No invented delivery dates or availability.
- No public use of private/internal documents.
- No answers from unapproved R&D or confidential production materials.

## Backlog Split

### MVP

- Public site redesign.
- Header/navigation updates.
- Product catalog structure.
- Public documents/news/service pages.
- Urania public UI shell.
- Forms and CRM handoff structure.
- CMS/admin minimal viable scope.
- Yandex Metrica and consent banner.

### Phase 2

- Full CRM integration.
- Full S3 document lifecycle.
- Authenticated internal document search.
- RAG quality evaluation.
- Employee access matrix.
- Multilingual RU/EN/ZH content.

### Phase 3

- Local/private LLM deployment.
- VLM pilot for service and production.
- Advanced internal analytics.
- Full corporate IT contour for 60 employees.

## Immediate Next Steps

1. Egor starts frontend from the approved first-screen visual and checklist.
2. Mikhail prepares API contracts and CMS data model.
3. NN confirms product list, documents, service conditions, and public wording.
4. Team reviews the first deployed stand before moving deeper into backend integration.
