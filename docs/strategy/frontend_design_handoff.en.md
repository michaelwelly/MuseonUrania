# Frontend Design Handoff

[Русский](frontend_design_handoff.md) · **English**

## Priority

First priority is the public website design and frontend package for `vedal-med.ru`.

CRM, S3, internal infrastructure, LLM/VLM, and corporate contour remain in the roadmap, but they should not block the first presentation and design handoff.

## Goal

Prepare a conservative B2B medical equipment website concept that can be handed to Claude or a frontend team for three fast design/frontend variants.

Smart Solution should be shown as a technology integration layer, not as a replacement for the VEDAL brand. Its role is to connect the website, forms, CRM/S3, metadata pipeline, and future AI search.

The title/hero page must include a reserved place for the public website assistant named Vedalina. Vedalina is a personified assistant inspired by the muse of astronomy: precise, calm, knowledge-oriented, and visually connected with celestial globe/compass/star-map motifs. The assistant must be secondary to VEDAL's product and production message.

Generated Vedalina assets are available under `assets/vedalina/`. Use `vedalina-avatar-middle-v1.png` as the recommended MVP avatar unless NN prefers the more medical or more celestial alternatives.

## First Release Pages

1. Home
   - positioning;
   - production signal;
   - redesigned hero/title section;
   - reserved Vedalina assistant area;
   - priority products;
   - trust/certification block;
   - partner block;
   - lead CTA.
2. Products
   - about 10 products;
   - categories;
   - filters;
   - request quote/catalog CTA.
3. Product detail
   - product name;
   - clinical/technical use;
   - advantages;
   - specs;
   - documents;
   - media;
   - registration/certification status.
4. Production
   - production photos;
   - quality management;
   - ISO/certification;
   - non-sensitive process story.
5. Documents
   - public catalog;
   - certificates;
   - press materials;
   - only approved documents.
6. Press center
   - Innoprom release;
   - events;
   - media kit.
7. Contacts
   - sales;
   - service;
   - partner request;
   - forms.

## Metadata To Fill After NN Answers

Each page and product card should be driven by metadata:

- `page_status`: draft / approved / blocked.
- `public_status`: public / internal / confidential.
- `product_priority`: 1-10.
- `product_category`: neonatology / resuscitation / anesthesia / monitoring / other.
- `certification`: RU / ISO / protocol / pending / unknown.
- `cta_type`: quote / catalog / consultation / service / partner.
- `asset_link`: source photo/video/PDF location.
- `language_ready`: RU / EN / ZH / HI.
- `approver`: person responsible for publication approval.
- `assistant_slot`: hidden / hero / floating button / both.
- `assistant_allowed_sources`: public pages / public PDFs / product catalog / none yet.

## Conservative Design Rules

- Use restrained medical/industrial B2B styling.
- Prioritize trust, clarity, catalog navigation, and document access.
- Avoid oversized marketing hero language.
- Avoid decorative gradients and noisy visuals.
- Show real equipment and production photos whenever possible.
- Keep CTAs practical: request quote, request catalog, consult specialist, service request.
- Reserve assistant UI space in the title screen without turning the site into an AI product landing page.

## Claude Handoff Prompt

Build three frontend concepts for a Russian medical equipment manufacturer website, using a conservative B2B style.

Core pages: home, products, product detail, production, documents, press, contacts.

Business goal: make the site both informational and sales-oriented. It must support product catalog, lead forms, approved public documents, press release content, and future CRM integration.

Include Smart Solution as a technology integration layer: site forms, CRM handoff, S3/document metadata, and future AI search. Do not make Smart Solution visually stronger than VEDAL on public-facing screens.

Include a public assistant named Vedalina. She should be represented as a restrained expert guide inspired by the muse of astronomy, using subtle celestial globe/compass/star-map motifs. She helps users navigate products, public documents, service and quote requests. She must not provide medical diagnosis, treatment advice, unapproved specifications, prices, or certification claims.

Variants:

1. Conservative manufacturer: trust, production, certification, documents.
2. Product-led catalog: product search, categories, quote/catalog CTAs.
3. Expert technology: R&D, production capability, international-ready language structure.

Use placeholder content where client answers are pending. Mark placeholders clearly as `awaiting NN answer`.

Do not invent certification claims, prices, clinical claims, or technical specifications.
