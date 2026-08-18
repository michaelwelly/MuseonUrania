# Project Brief

[Русский](project_brief.md) · **English**

## Working Name

MuseonVedalina: digital infrastructure for VEDAL medical equipment production and sales.

## Business Context

VEDAL is positioned as a Russian manufacturer of medical devices for neonatology, anesthesiology, and resuscitation. The current public website, `vedal-med.ru`, already states the core positioning, basic product directions, production focus, and partners, but it needs to become a stronger sales and information system.

Related/partner ecosystem:

- `vedal-med.ru`: primary public site and future commercial entry point.
- `morus-ms.ru`: related medical systems/manufacturing company, especially MRI direction.
- `divisy.ru`: partner for integrated medical complexes, telemedicine, conferencing, and multimedia systems.
- Possible foreign brand relation/reference: `vedal.com.cn`, useful for multilingual catalog and product taxonomy comparison.

## Objective

Build the full IT foundation for production and sales of medical equipment:

- Public site and catalog for lead generation.
- Media and documentation storage.
- CRM and sales workflow.
- Internal communications and video meetings.
- Closed corporate and production contours.
- Analytics, SEO, multilingual content.
- AI-assisted document search and future production/service VLM workflows.

## Strategic Thesis

The site should serve two missions at once:

- Inform: show production, certification, technology, product readiness, public documents, press releases, and trust signals.
- Sell: capture requests for consultations, КП, catalog downloads, dealer conversations, service requests, and partner leads.

The internal platform should make sales and service teams faster by giving them controlled access to manufacturing knowledge, product documentation, certificates, service manuals, media, and approved commercial materials.

## Key Assumptions

- Product portfolio is about 10 products.
- Photos and media already exist in a cloud folder and need to be requested.
- Innoprom press-release materials exist or can be reconstructed from source materials.
- Some documentation can be public, while technical, production, service, regulatory, or R&D materials require classification before publication.
- The first production contour can be built on Yandex Cloud or Google Workspace, with Kontur discussed as an alternative for Russian business/regulatory fit.

## Immediate Next Decisions

- Confirm exact domain spelling and ownership: `vedal-med.ru` vs `vedalmed.ru`.
- Confirm whether the public site remains WordPress or is rebuilt as a custom frontend/backend.
- Choose primary corporate stack: Yandex, Google, Kontur, or hybrid.
- Decide where S3-compatible storage lives: Yandex Object Storage, Selectel S3, VK Cloud, MinIO, or another provider.
- Confirm AI deployment model: cloud API first, local/on-prem GPU later, or immediate private GPU contour.
