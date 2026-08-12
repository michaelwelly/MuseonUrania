# Functional Requirements

[Русский](functional_requirements.md) · **English**

## Public Website

### Landing Page Enrichment

The existing `vedal-med.ru` landing page should be expanded with:

- Redesigned title/hero section: clearer first screen, stronger product/production message, practical CTA, and a reserved assistant area.
- Clear production positioning: Russian medical equipment for neonatology, anesthesiology, resuscitation, intensive care.
- Product blocks for all portfolio items.
- Production photos and factory story.
- Quality and certification story, including ISO 13485 and registration status where legally safe.
- Partner block for Divisy and Morus MS.
- Press/news block, including Innoprom press release.
- Lead forms for consultation, catalog request, КП request, dealer inquiry, service inquiry.
- Contact block with phone, email, sales email, address, and legal consent text.

### Title Page / Hero Requirements

The first screen of the public site must be redesigned.

Required elements:

- VEDAL logo and navigation.
- One clear headline about Russian medical equipment production.
- Supporting text focused on neonatology, resuscitation, intensive care, and production capability.
- Primary CTA: request КП / consultation.
- Secondary CTA: open product catalog.
- A visible reserved area for the site assistant Urania.
- Production/product visual as the main evidence image.
- No unsupported medical claims, prices, or certification claims until approved.

The assistant area should not compete with the product and production message. It should work as a guided helper: "Ask Urania about products, documents, service, or catalog selection."

### Site Assistant: Urania

The public website should include an AI assistant named Urania.

Concept:

- Urania is inspired by the Greek muse of astronomy.
- Based on Wikipedia reference, Urania is associated with astronomy and with attributes such as the celestial globe and compass.
- The visual image should be calm, precise, expert, and celestial, but not fantasy-heavy.
- The assistant should feel like a guide through products, documents, and next steps, not like a medical decision-maker.

Primary assistant jobs:

- Help users choose a product category.
- Answer questions from approved public product/catalog/document content.
- Guide users to request КП, catalog, consultation, or service.
- Explain where documents are located.
- Collect lead context before passing to CRM.
- Hand off uncertain or sensitive questions to a human specialist.

Safety and compliance:

- Urania must not provide medical diagnosis or treatment advice.
- Urania must not invent specifications, certification status, prices, delivery times, or clinical claims.
- Urania must cite or link to approved public source pages/documents when answering factual questions.
- Internal/private documents must not be exposed through the public assistant.
- Sensitive or uncertain questions should end with a human contact/lead form.

### Product Catalog

Expected products, based on public `vedal-med.ru` content:

- VEDAL VV11: ventilator.
- VEDAL VP4: portable intensive therapy ventilator.
- VEDAL N6: inhalation anesthesia device.
- VEDAL N12: patient monitor.
- VEDAL N15: patient monitor.
- VEDAL VN10: portable neonatal ventilator.
- VEDAL N1: neonatal incubator.
- VEDAL N2: neonatal incubator.
- VEDAL N3: neonatal incubator.
- A-2000: incubator-transformer / open resuscitation system.
- VEDAL R1: neonatal resuscitation system.
- VEDAL R2: neonatal resuscitation system.
- Neonatal thermoregulation system.

This list must be reconciled with Nikolay Nikolaevich's catalog because the voice brief says "10 products", while public site content implies more named SKUs or product variants.

Each product card/page should include:

- Product name and category.
- Medical use case.
- Main clinical/technical benefits.
- Photos and/or video.
- Technical specification summary.
- Downloadable public documents.
- Registration/certification status.
- CTA: request КП, request catalog, talk to specialist, request service.

## Media And Documentation Storage

Create S3-compatible object storage for:

- Product photos.
- Production photos.
- Videos.
- Catalog PDFs.
- Certificates and declarations.
- Manuals and service documentation.
- Press materials.
- Private technical/R&D documents.

Required features:

- Public bucket or CDN-backed path only for approved media/documents.
- Private buckets for sensitive documentation.
- Role-based access.
- Versioning and lifecycle rules.
- Metadata tags: product, language, public/private, document type, revision, source owner, approval status.

## CRM And Sales

CRM must support:

- Lead capture from website forms.
- Product interest tagging.
- КП workflow.
- Dealer/partner pipeline.
- Service request pipeline.
- Sales owner assignment.
- Email/phone history.
- Attachments from approved S3 documents.
- Analytics by product, source, language, and campaign.

## Internal Employee Contour

Target scale: 60 employees.

Required systems:

- Corporate email.
- Calendar and video meetings.
- Internal messenger.
- File/document storage.
- VPN or zero-trust access.
- Access groups for sales, service, production, engineering, management, marketing.
- Device/account lifecycle: onboarding, offboarding, MFA, recovery.

Candidate stacks:

- Yandex 360 + Yandex Cloud + Yandex Tracker/CRM-compatible stack.
- Google Workspace + external CRM + cloud/VPN restrictions.
- Kontur ecosystem, if it covers legal/regulatory/business requirements better.
- Hybrid: Russian infrastructure for sensitive data, global tools only for non-sensitive collaboration.

## AI Knowledge Search

Build an internal knowledge system that:

- Ingests approved folders and document sets.
- Separates public, internal, confidential, service, production, and R&D documents.
- Chunks documents for semantic search.
- Stores embeddings in a vector database.
- Provides staff-facing search/chat interface.
- Shows source citations and file links.
- Enforces document-level permissions.

Primary users:

- Sales specialists: fast answers from product and production documentation.
- Service engineers: manuals, troubleshooting, photos/videos, revision history.
- Management: quick summaries and document discovery.
- Marketing/SEO: approved public facts and reusable content.

## VLM For Production And Service

Future VLM workflows:

- Service photo/video analysis.
- Visual inspection assistance.
- Assembly/service checklist support.
- Defect classification support.
- Training material generation.
- Production documentation indexing by image.

This must be treated as a staged initiative because medical-device production and service contexts require strict validation, human review, and data governance.
