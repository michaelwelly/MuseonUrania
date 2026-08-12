# Roadmap

[Русский](roadmap.md) · **English**

## Stage 0: Discovery And Material Collection

Duration: 1-2 weeks.

- Confirm stakeholders and decision owners.
- Request materials from Nikolay Nikolaevich.
- Export/snapshot current `vedal-med.ru`.
- Build product and document inventory.
- Classify materials: public, internal, confidential, R&D, service.
- Choose infrastructure stack candidates for comparison.

Deliverables:

- Approved product list.
- Content inventory.
- Risk/sensitivity map.
- Initial architecture decision.

## Stage 1: Public Site MVP

Duration: 2-4 weeks after materials are received.

- Update/rebuild landing page.
- Add product catalog and product pages.
- Add press/news section and Innoprom release.
- Add S3/CDN media delivery.
- Add forms and CRM routing.
- Add Yandex Metrica.
- Add SEO basics and sitemap.
- Prepare Russian content first.

Deliverables:

- Public site MVP.
- Product catalog.
- Lead capture workflow.
- Analytics dashboard.

## Stage 2: Corporate IT Contour

Duration: 3-6 weeks.

- Select Yandex/Google/Kontur/hybrid stack.
- Configure email, calendar, meetings, messenger.
- Configure identity, MFA, access groups.
- Configure VPN/zero-trust access.
- Configure CRM and sales pipeline.
- Configure private S3/document storage.
- Define onboarding/offboarding process for 60 employees.

Deliverables:

- Working employee accounts and access matrix.
- CRM pipelines.
- Private document storage.
- Basic sysadmin runbook.

## Stage 3: AI Knowledge Search

Duration: 4-8 weeks.

- Build ingestion pipeline for approved internal documents.
- Add OCR/PDF parsing where needed.
- Chunk documents with metadata.
- Store embeddings.
- Build internal search/chat interface with citations.
- Enforce permissions and audit logs.
- Pilot with sales and service teams.

Deliverables:

- Internal AI search MVP.
- Sales/service knowledge base.
- Usage and quality feedback loop.

## Stage 4: Multilingual And Internationalization

Duration: 2-6 weeks depending on approval speed.

- Translate public content to English and Chinese.
- Add language routes and hreflang.
- Prepare Hindi later as market-entry content.
- Review claims and compliance per target geography.

Deliverables:

- RU/EN/ZH site.
- International catalog pages.
- Translation workflow.

## Stage 5: VLM For Production And Service

Duration: pilot-first.

- Identify 2-3 high-value visual workflows.
- Collect non-sensitive/sanitized visual dataset.
- Test managed VLM vs private deployment.
- Validate with service/production experts.
- Add human review and audit.

Deliverables:

- VLM pilot report.
- Cost and infrastructure plan.
- Go/no-go decision for production rollout.
