# Presentation for Nikolay Nikolaevich

[Русский](nn_presentation_outline.md) · **English**

## Purpose of the presentation

To show a clear plan for developing VEDAL as a medical equipment manufacturer:
from strengthening the current website and catalog to a full IT infrastructure for
sales, manufacturing, service and internal work with documentation through AI.

## Working title

VEDAL: digital infrastructure for the manufacturing, sales and service of medical
equipment.

## Slide 1. Context

VEDAL already has a basic public presence and a product foundation in the medical
equipment domain for neonatology, anesthesiology and resuscitation. The next step
is to turn the website and the internal materials into a full commercial and
operational contour.

The key idea:

- the website should not only inform but also sell;
- employees should quickly find technical, product and service information;
- the infrastructure should be ready for the company's growth and for adopting AI.

## Slide 2. What has to be done first

The first stage:

- extend the existing landing page `vedal-med.ru`;
- carve out a catalog of about 10 products;
- add the press release and the Innoprom materials;
- connect Yandex Metrica;
- set up lead collection;
- move media and documents into S3 storage;
- separate public and internal documents.

## Slide 3. The public website

The website must cover two jobs:

- informing the market: who VEDAL is, what it manufactures, what technologies,
  quality, certificates and partners it has;
- selling: requests for a consultation, a quote, the catalog, partnership, service.

Recommended sections:

- home;
- products;
- manufacturing;
- R&D and technology;
- documents;
- press centre;
- partners;
- service;
- contacts.

## Slide 4. The product catalog

Every product needs a card:

- name;
- intended use;
- category;
- key advantages;
- technical specifications;
- photo and video;
- documents;
- registration and certification status;
- buttons: request a quote, download the catalog, get a consultation.

It is important to confirm the final product list for the first release.

## Slide 5. Media and documents

A single S3 store has to be created for:

- public photos and documents for the website;
- internal documents for sales, service and manufacturing;
- archives with catalogs and exhibition materials;
- certificates and regulatory documents;
- video, instructions, presentations.

The key rule: everything is classified first, and only after that does part of the
material go public.

## Slide 6. CRM and sales

The CRM must accept leads from the website and carry the sales cycle:

- consultation;
- quote request;
- interest in a specific product;
- partner request;
- service request;
- follow-up contact.

This produces a managed sales funnel and analytics by product.

## Slide 7. Corporate infrastructure

A team of up to 60 people needs a single office and production IT environment:

- corporate mail;
- calendar;
- video meetings and telebridges;
- an internal messenger;
- file storage;
- VPN or a closed contour;
- access roles;
- a basic sysadmin process.

Options for discussion:

- Yandex;
- Google;
- Kontur;
- a hybrid scheme.

## Slide 8. The AI platform

We propose building internal AI search over the documentation:

- document ingestion;
- splitting into fragments;
- semantic search;
- answers with links to sources;
- role-based access;
- a separate contour for sensitive data.

The practical effect: a sales manager or a service specialist finds the needed
technical information faster and does not lose time on manual folder searches.

## Slide 9. VLM for service and manufacturing

The next stage is visual AI models working with photo and video:

- helping service engineers via photo and video;
- analysing the condition of assemblies;
- visual checklists;
- employee training;
- supporting quality control.

This should be launched as a pilot: safe scenarios first, expansion after quality
is verified.

## Slide 10. SEO and multiple languages

The website is designed as multilingual from the start:

- Russian;
- English;
- Chinese;
- Hindi as the next stage.

SEO is built from product and technical documentation, but only after verifying
that the information is cleared for publication.

## Slide 11. The work plan

- Thursday, 23 July 2026: collecting materials, questions, the presentation
  structure.
- Friday, 24 July 2026: a version of the presentation for Nikolay Nikolaevich,
  corrections collected until the end of the day.
- Monday, 27 July 2026: the final assembly, fact-checking, tests, preparing the
  demonstration.
- Tuesday, 28 July 2026: the presentation to stakeholders.

## Slide 12. What has to be decided now

1. Confirm the product list.
2. Hand over the catalog and the Innoprom materials.
3. Hand over photos, video and documents.
4. Determine what may be published.
5. Choose the base IT stack: Yandex, Google, Kontur or a hybrid.
6. Confirm the staging: the website and CRM first, AI and VLM as the next contour.

## Clarifying questions before the design stage

### About the website

1. Do we keep the current `vedal-med.ru` and extend it, or prepare a new version?
2. Which sections must be in the first version?
3. Are prices needed on the website, or only requests and quotes?
4. Who approves public wording about medical devices?
5. Which forms are needed: quote, catalog, consultation, service, partnership?

### About the products

1. Which 10 products are in the first release?
2. Which products are the sales priorities?
3. Which products are already ready for public promotion?
4. Where are the registration certificates, certificates, protocols, ISO?
5. Which specifications may be published without risk?

### About the materials

1. Where are the photos, video, catalogs and presentations stored?
2. Are the Innoprom materials available in ready form?
3. Which documents are strictly internal?
4. Are there English or Chinese materials?
5. Who gives the final approval for publishing documents?

### About the infrastructure

1. The preferred contour: Yandex, Google, Kontur or a hybrid?
2. Is there a requirement to keep data in Russia only?
3. Is a VPN needed right away?
4. Which CRM is currently used or under consideration?
5. Who will administer users and access?

### About AI

1. Which documents may be used for internal AI search?
2. Is a fully closed contour needed for LLM/VLM?
3. Which first AI scenarios are the most valuable: sales, service, manufacturing,
   R&D?
4. Can we start with a Yandex cloud model and move the GPU contour into a pilot?
5. Which data must never be sent to external AI services under any circumstances?

## Short spoken version

We propose going stage by stage. First we strengthen the public VEDAL website: we
build a proper catalog, add the Innoprom materials, documents, manufacturing,
lead forms and analytics. In parallel we create a proper store for media and
documentation, where public and sensitive materials are separated from the start.
The next layer is the CRM and the corporate infrastructure for a team of up to 60
people: mail, meetings, messenger, access, VPN and closed contours. After that we
can launch internal AI search over the documentation so that sales, service and
manufacturing find the knowledge they need faster. As a separate pilot we propose
VLM for service and manufacturing, where visual models help work with photos,
video, diagnostics and inspection.
