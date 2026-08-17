# VEDAL Portal: the closed contour and CRM

[Русский](vedal_portal_owner_brief.md) · **English**

A transcript of the owner presentation `VEDAL_owner_closed_contour_and_CRM_v1.pdf`
(8 slides, stored in this folder). Material for the first discussion and for
collecting feedback.

The document defines the target architecture: the website, the CRM and the closed
contour are one platform, not a storefront on one side and bookkeeping on the
other. Everything we do in `frontend/` and `backend/` must fit into it.

## 1. The idea

The website, the CRM and the closed contour in a single managed architecture.

- **We continue the website.** Frontend, backend, forms, sign-in and the CRM
  module evolve as one platform.
- **We separate the contours.** Open communications stay in Yandex 360, sensitive
  data stays inside.
- **We give control.** Leads, deals, documents, access, audit and budget become
  transparent to the owner.

## 2. The website as the entry point to sales and management

Not a separate storefront, but the foundation of VEDAL Portal for customers and
employees.

| Already agreed | We add | What it solves |
| --- | --- | --- |
| the VM and the website with frontend/backend | a CRM inside VEDAL Portal | the customer base does not live in email |
| the public catalog and request forms | a controlled gateway between systems | deals and quotes are handled in one place |
| an entry point for the internal section | roles, audit, documents and backups | the owner sees a managed picture |

## 3. The architecture diagram

The diagram lives in the Form XObject `/Meta25` and used to be unreadable: the
`ToUnicode` of its fonts is nearly empty (6 and 4 entries for 85 glyphs). The
glyph-to-character mapping was restored from the `cmap` table of the embedded
TrueType font — the content is below.

The caption under the title: "A normal package: the already agreed VM and website
become the foundation of the product; Yandex 360 is the open office; closed data
is managed inside VEDAL Portal/CRM."

Five vertical lanes, left to right:

| Lane | What is inside |
| --- | --- |
| **Users** | Customer, Salesperson, Accountant, Admin/InfoSec, Owner |
| **Open office** — we buy it, Yandex 360 | Mail on the domain, Calendar, Telemost, Forms, Disk without secrets, Wiki/Tracker for shared operations |
| **The agreed website / VM** — we develop it as a product | Public Frontend (site + catalog), Lead Forms (quote / consultation / service), Urania public assistant (approved content only), Backend API (forms, catalog, personal sign-in), Admin panel / CMS, Login area (entry into the closed CRM) |
| **DMZ / Controlled integration** — we write it for this project | Integration Gateway (webhook/API intake), Event queue, Antivirus / DLP, Manual approve, Outbound templates, Import/export audit |
| **The closed contour** — on the VM plus private managed services | VEDAL CRM inside the site, Document Vault, PostgreSQL as the source of truth, Private Object Storage, Keycloak + MFA + roles, VPN / Zero Trust, Logs + backups |

Closed-contour options on the slide: Lockbox, Audit Trails, WAF, Managed
PostgreSQL, Cloud Backup. The caption on the website lane: "What we are writing
now: the site, the backend, the forms, the CRM skeleton and access roles."

Labels on the arrows between lanes: a request from the website, mail → form/lead,
a webhook from a form, site events, employee sign-in, approved lead, approved
doc, a templated letter, invoices and acts kept inside, outbound without secrets,
access management, SSO/MFA access, dashboard/reports.

Three scenarios along the bottom of the slide:

- **Salesperson.** A lead arrives from the site, a form or mail → the gateway
  checks the source and the attachments → a draft is created in the CRM → the
  salesperson runs the deal and the quote inside the closed contour → only a
  sanitized letter goes to the customer.
- **Accountant.** Sign-in through VPN/SSO/MFA → invoices, acts and contracts come
  from the CRM/Document Vault → EDI/1C/Kontur are connected as an external
  accounting integration → statuses, numbers and links come back into the CRM,
  not the whole financial kitchen.
- **Admin and owner.** The admin manages users, groups, access and backups → the
  owner sees a dashboard (leads, deals, sources, statuses) → incidents are
  investigated through the logs of the site, the gateway, the CRM and the cloud
  audit trail.

**What was not in the text of the brief:** sign-in is built on **Keycloak + MFA**
rather than on our own authorization; there is an **event queue** between the site
and the CRM; attachments pass through **antivirus/DLP**; there is a **manual
approve** step before handover to the CRM; documents live in a **private object
store**; the closed contour is closed off by **VPN / Zero Trust**.

## 4. What we buy and what we write

The principle: we do not rewrite standard services, we keep unique logic to
ourselves. This reduces risk.

**We buy**

- Yandex 360: mail, calendar, Telemost, Forms.
- Yandex Cloud: VM, backup, logging, monitoring.
- Managed PostgreSQL, Lockbox, WAF as they become relevant.

**We write**

- VEDAL Portal: the site, the backend, the forms, sign-in.
- The CRM: leads, customers, deals, quotes, statuses.
- The Integration Gateway: rules, approve, audit.

**We do not expose outside**

- The customer base and commercial terms.
- Contracts, invoices, margins, tokens, personal data.
- Internal reports and management decisions.

## 5. The path of a deal

A request may arrive from the site, a form or mail, but there is one source of
truth.

1. **Request.** The website, a Yandex Form or corporate mail.
2. **Validation.** The gateway checks the source, the fields and the attachments.
3. **Draft lead.** The CRM creates a record without automatic access to closed
   data.
4. **Deal and quote.** The salesperson keeps history, documents and statuses
   inside the portal.
5. **Reply to the customer.** Only a templated letter or an approved document
   goes outside.

The result: fewer manually lost leads and less sensitive information in the open
office contour.

## 6. Roles and audit

For 50 employees the key gain is not in sophistication but in access discipline.

**Accountant**

- Signs in through VPN/SSO/MFA.
- Works with invoices, acts, contracts and payment statuses.
- The 1C/Kontur integration is connected without exposing the whole financial
  kitchen.

**Admin / InfoSec**

- Provisions employees through groups and roles.
- Termination: SSO/VPN blocked and sessions revoked.
- Incidents are investigated through the logs of the site, the gateway, the CRM
  and the cloud audit trail.

## 7. Infrastructure budget

Excluding development and maintenance.

| Item | ₽/month |
| --- | ---: |
| Yandex 360 for 50 employees | ≈ 27,450 |
| VM + application + backend | 5,000 – 12,000 |
| Managed PostgreSQL / hardened database | 8,000 – 18,000 |
| Backups, Object Storage, logs, monitoring | 5,000 – 15,000 |
| Security: Lockbox, WAF, audit | 1,000 – 9,000 |
| Kontur.Diadoc / EDI | 1,000 – 2,500 |
| **Total** | **50,000 – 80,000** |

## 8. The first stage

The goal of the meeting is not to finalize details but to get agreement on the
direction.

**Decisions that need to be made**

1. Do we build the CRM inside VEDAL Portal?
2. Which data is forbidden to store in Yandex 360?
3. Who gets access to the CRM at the first stage?
4. Is an integration with 1C/Kontur needed right away?

**Contents of the first release**

- The public website and catalog.
- The backend API, forms and authorization.
- Leads, customers, deals, quotes and documents.
- Roles, audit, backups and a basic gateway.

**The recommendation from the presentation:** continue developing the website
right away as the foundation for VEDAL Portal, so the architecture does not have
to be redone after the storefront launches.

## What this changes for us

- The employee count here is 50, while in
  [functional_requirements.en.md](../strategy/functional_requirements.en.md) and
  [infrastructure_architecture.en.md](infrastructure_architecture.en.md) it is 60.
  The discrepancy is unresolved.
- The stack is defined more firmly than in
  [infrastructure_architecture.en.md](infrastructure_architecture.en.md), where
  Yandex/Google/Kontur were still being compared: here Yandex 360 + Yandex Cloud
  + Managed PostgreSQL is chosen.
- The CRM is our own, inside the portal, not Bitrix24 or amoCRM.
- Website forms send a lead not directly into the CRM but through the Integration
  Gateway, with validation of the source, the fields and the attachments.
