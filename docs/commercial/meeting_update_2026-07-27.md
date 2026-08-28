# Meeting Update 2026-07-27

## Decision Summary

Project delivery is planned as a 4-week implementation track with readiness by 2026-09-01.

The practical delivery team is 4 people, while several roles are combined:

- Mikhail: PM/analyst, backend/CMS, frontend lead, content/SEO, DevOps coordination.
- Egor: UX/UI, frontend, frontend QA scenarios.
- Nikolay Nikolaevich: customer-side ROP/product owner/reviewer, approves structure and key implementation decisions.
- VEDAL stakeholders: approve public content, legal/compliance wording, product/document publication.

The first visual direction is accepted. Instead of preparing 3 full visual designs, the team should prepare 3 structural variants for discussion:

- Variant 1: conservative manufacturer website.
- Variant 2: product-led catalog website.
- Variant 3: expert technology and service platform.

After NN selects the structure, the team proceeds to page layout and implementation.

## Scope Confirmed

The project covers:

- Public website for VEDAL medical equipment production and sales.
- Updated title page with Urania assistant area.
- Product catalog and product pages.
- Service route with approved warranty conditions.
- News route in the top navigation between documents and contacts.
- Forms for КП, catalog, consultation, partnership, service.
- CMS/admin area for content management.
- S3-compatible media/document storage.
- Open contour for public website and approved documents.
- Closed contour for employees and internal documentation.
- Initial CRM handoff from website forms.
- Yandex Metrica.
- SEO basics and public metadata.
- Preparation for AI search over approved documentation.
- Urania public mode for approved public documents and authenticated closed-contour mode for internal search after login.
- Initial Yandex LLM API integration, with later migration option to local LLM/VLM on large VM.

## Key Constraints

- Personal data, databases, and sensitive materials must be stored in Russian infrastructure.
- Public and private documentation must be separated before publication or AI ingestion.
- Cookie banner and personal data consent wording are required.
- Advertising and Yandex Direct materials require approval and legal/compliance review.
- Medical-device public claims must be approved by VEDAL before publication.
- The repository `MuseonUrania` is part of the deliverable and will be transferred to the customer after implementation.
