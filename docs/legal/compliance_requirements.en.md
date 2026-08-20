# Compliance Requirements: VEDAL Public And Internal Contours

[Русский](compliance_requirements.md) · **English**

This document is an operational requirements checklist, not a legal opinion. Final legal wording should be approved by VEDAL or its legal counsel before publication and contract signing.

## Personal Data And Hosting

Requirements:

- Store databases and personal data in infrastructure located in the Russian Federation.
- Keep website forms, CRM handoff, logs, backups, and AI-search indexes inside approved Russian infrastructure when they contain personal data or sensitive business data.
- Use separate open and closed contours.
- Use role-based access for the closed contour.
- Enable MFA for admin, hosting, repository, cloud, and CRM accounts.
- Document data owners and access owners.

## Public Website Consent

Required website elements:

- Cookie banner.
- Link to privacy policy / personal data processing policy.
- Consent text near forms.
- Consent checkbox where personal data is submitted.
- Separate consent/notice for analytics cookies where required.
- Clear channel for revoking consent or requesting personal data handling information.

## Medical Equipment Public Claims

Requirements:

- Do not publish unsupported clinical, certification, registration, delivery, warranty, or price claims.
- Publish only approved documents and wording.
- Link product claims to approved public catalog pages, certificates, registration documents, or official VEDAL statements.
- Route ambiguous product or clinical questions to a human sales/service specialist.
- Vedalina assistant must not provide diagnosis, treatment recommendations, or unapproved medical claims.

## Advertising And Yandex Direct

Requirements:

- All advertising texts and creatives must be approved by VEDAL before launch.
- Product claims in ads must match approved public site content.
- Advertising marking and reporting workflow should be defined before paid campaign launch.
- UTM and analytics structure should be agreed before campaign launch.

## Open And Closed Contours

Open contour:

- Public website.
- Public product catalog.
- Public documents and press releases.
- Lead forms and public Vedalina assistant limited to approved public knowledge.

Closed contour:

- CMS/admin.
- Internal documentation.
- Service/production/R&D materials.
- AI search over internal documentation.
- CRM data and lead/customer history.
- Access logs, backups, and operational credentials.

## AI Data Governance

Requirements:

- Classify every document before AI ingestion: public, internal, confidential, service, production, R&D.
- Do not send confidential documents to external AI services without written approval.
- Initial LLM integration may use Yandex API only for approved data and scenarios.
- Local LLM/VLM on a separate large VM should be scoped as a later controlled phase.
- AI answers must include source links/citations where possible.
- AI must hand off uncertain, sensitive, or regulated questions to a human specialist.

## Source Links For Legal Review

- Federal Law No. 152-FZ "On Personal Data": https://pravo.gov.ru/
- Roskomnadzor personal data portal: https://pd.rkn.gov.ru/
- Federal Antimonopoly Service guidance and advertising regulation materials: https://fas.gov.ru/
- Internet advertising accounting / ERIR entry point: https://erir.grfc.ru/

