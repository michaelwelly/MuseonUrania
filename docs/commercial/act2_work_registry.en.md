# Work Registry for Acceptance Act No. 2

[Русский](act2_work_registry.md) · **English**

## Purpose

This document supports the preparation of Acceptance Act No. 2 (issue
[#40](https://github.com/michaelwelly/MuseonUrania/issues/40)) with facts
from the repository: what has been technically delivered, what confirms it,
what remains, and who it depends on. The registry does not replace the act
itself: amounts, deadlines, and cost are not stated here — that is not its
part.

State was reconciled on September 7, 2026 against the code on branch `dev`
(build of the `back`, `front`, `infra`, `docs` layers), as recorded in
[docs/PROJECT.md, section 6](../PROJECT.md#6-текущее-состояние). The
confirmations below are concrete API routes, test coverage, and the
end-to-end stand run protocol from issue
[#57](https://github.com/michaelwelly/MuseonUrania/issues/57) ("End-to-end
stand run before handover", run of September 7).

---

## 1. Public website

- Ten website routes: `/`, `/products`, `/products/[slug]`, `/production`,
  `/documents`, `/news`, `/news/[slug]`, `/service`, `/about`, `/contacts`,
  plus `/legal/privacy`. Thirteen product cards, five categories.
- Catalog, news, and documents are read from the Public API
  (`/api/public/v1/categories`, `/products`, `/products/{slug}`, `/news`,
  `/news/{slug}`, `/documents`, `/documents/{slug}/file`) at build time; a
  backend outage does not bring down the built static site.
- A sitemap and `robots.txt` built from the portal, and a dedicated tab
  icon.
- The sitemap was brought in line with the actual routes (issue
  [#59](https://github.com/michaelwelly/MuseonUrania/issues/59)).

**Confirmation:** 353 frontend tests across 33 files — passing (PROJECT.md
section 6.2). Issue [#52](https://github.com/michaelwelly/MuseonUrania/issues/52)
(SEO: sitemap.xml, robots.txt, canonical, OG) closed; issue
[#61](https://github.com/michaelwelly/MuseonUrania/issues/61) (site icon)
closed. Run protocol #57: `robots.txt` — `Disallow: /` (the stand is closed
to indexing by design), `/icon.png` served, product photos — `200` on every
request.

## 2. Admin panel and CRM

- Twenty-four admin routes: site content (products, categories, news,
  documents, audit log) and CRM (leads, clients, deals across three
  pipelines, quotes, analytics in four dimensions).
- Forty-seven routes and sixty-five operations of the Admin API are
  documented as a separate specification —
  [docs/api/vedal-admin-openapi.yaml](../api/vedal-admin-openapi.yaml).
- Staff accounts and roles work on the stand through Keycloak (issue
  [#43](https://github.com/michaelwelly/MuseonUrania/issues/43), closed).
- There is no public entry point to CRM: the client base, deal amounts,
  and quote prices are a closed contour and never leave it, including
  Kafka events (identifier, pipeline, stage — no client name, no amount).
- The "Conversations" widget no longer overlaps admin content (issue
  [#49](https://github.com/michaelwelly/MuseonUrania/issues/49), closed).

**Confirmation:** 166 Java files in the portal, 56 test classes and 364
backend tests — passing (PROJECT.md section 6.1). Run protocol #57: admin
login — token and `portal-admin` role obtained; full cycle "draft created →
published → appeared in `/api/public/v1/news` → unpublished → deleted"
passed with no trace left; conversations widget — a 60×60 circle instead of
a pill, overlap checked.

## 3. Vedalina assistant

- The answer is formulated by YandexGPT over search across published
  material (`vedal.assistant.engine=yandexgpt`); the source links under the
  answer come from the portal, not the model.
- The conversation streams with a "typing" indicator
  (`/api/assistant/v1/chat`, `/stream`, `/typing`), a handoff from the chat
  creates a lead with a human-readable number, specialist presence and
  support hours are shown, and the visitor can rate the answer (`/rating`).
- Guardrails are enforced before the model call, not in the prompt: closed
  material is physically unreachable because `LlmEngine` only goes through
  `CatalogQuery`, `ContentQuery`, `DocumentQuery`, which return published
  content exclusively. No sources — no fabrication, a handoff to a human
  instead.
- The assistant answers in the language of the question and stays on
  substance, reducing to defined scenarios (issue
  [#63](https://github.com/michaelwelly/MuseonUrania/issues/63), closed).

**Confirmation:** run protocol #57: an answer about a product with source
links (`[3]`); no sources — a clarifying question, no fabrication; a
question in English about price — answered in English following the rule
"prices are not published, leave a request."

## 4. Infrastructure and operations

- A nightly database backup with a restore check (issue
  [#41](https://github.com/michaelwelly/MuseonUrania/issues/41), closed)
  and an off-machine copy in a separate bucket with a write key (issue
  [#66](https://github.com/michaelwelly/MuseonUrania/issues/66), closed).
- Stand liveness is checked every five minutes: disk space, mail queue
  (issue [#44](https://github.com/michaelwelly/MuseonUrania/issues/44),
  closed).
- The gateway behind Caddy passes the portal the visitor's real address,
  not the proxy's (issue
  [#58](https://github.com/michaelwelly/MuseonUrania/issues/58), closed).
- The open `vedal-media` bucket serves photos while bucket listing stays
  closed (issue [#55](https://github.com/michaelwelly/MuseonUrania/issues/55),
  closed).
- CI: three independent checks — Dependabot on dependency versions,
  CodeQL on code, Trivy inside images (split threshold: HIGH shown in the
  report, CRITICAL with an available fix fails the build) — PROJECT.md
  section 7, item 14.

**Confirmation:** run protocol #57 (visitor address in the audit log,
photos `200`, listing closed); [docs/operations](../operations) describes
backup and restore.

## 5. Security and audit

- An audit log with filters and a `correlation_id` chain
  (`/api/admin/v1/audit`); a request for a closed document is recorded
  (`document.access.denied`).
- Roles are read from Keycloak (`realm_access.roles`); local accounts are
  only a fallback profile, `vedal.iam.mode=local`.
- The application role's database rights were cut by migration `V15`: the
  audit log is protected by a `BEFORE TRUNCATE` trigger,
  `UPDATE`/`DELETE`/`TRUNCATE` revoked — PROJECT.md section 7, item 17.
- A lead is accepted with an `Idempotency-Key`, and personal-data consent
  is required before a form submits.

**Confirmation:** run protocol #57: requesting a closed document —`404`
and a `document.access.denied` entry in the audit log; the log records the
visitor's real address, not the gateway's (issue #58).

---

## Residual work depending on the customer

Tagged `customer-blocked` — waiting for customer materials, access, or a
decision:

| Issue | What | Why it waits on the customer |
| --- | --- | --- |
| [#34](https://github.com/michaelwelly/MuseonUrania/issues/34) | Final photos and video from the customer's contractor | material sits with the customer's contractor |
| [#35](https://github.com/michaelwelly/MuseonUrania/issues/35) | Final texts, documents, and publication approvals | texts and publication approvals are the customer's |
| [#36](https://github.com/michaelwelly/MuseonUrania/issues/36) | Domain `vedal-med.ru` and HTTPS without changing mail | domain control sits with the customer |
| [#39](https://github.com/michaelwelly/MuseonUrania/issues/39) | 1C CRM handoff: exchange method and owner | the exchange-method decision is the customer's |
| [#46](https://github.com/michaelwelly/MuseonUrania/issues/46) | SMTP: lead notification emails | a mailbox is needed to send from |
| [#47](https://github.com/michaelwelly/MuseonUrania/issues/47) | Lead retention period and personal-data auto-cleanup | needs the customer's decision on retention period |
| [#53](https://github.com/michaelwelly/MuseonUrania/issues/53) | Yandex Metrica and consent banner | needs the counter and consent text from the customer |
| [#54](https://github.com/michaelwelly/MuseonUrania/issues/54) | Multilingual support: English and Chinese | needs approved text in these languages |
| [#68](https://github.com/michaelwelly/MuseonUrania/issues/68) | Incorrect KPP in company details | the correct value sits with the customer |
| [#69](https://github.com/michaelwelly/MuseonUrania/issues/69) | Social media buttons: addresses or removal | social media addresses are the customer's |
| [#72](https://github.com/michaelwelly/MuseonUrania/issues/72) | Products: remove "pending clarification" without replacing it with a guess | needs real specifications from the customer |
| [#75](https://github.com/michaelwelly/MuseonUrania/issues/75) | Product catalog as a single PDF | catalog material sits with the customer |
| [#76](https://github.com/michaelwelly/MuseonUrania/issues/76) | Working hours: 9:00-17:30 or an auto-reply | needs the customer's decision on the mode |
| [#77](https://github.com/michaelwelly/MuseonUrania/issues/77) | Staff on the contacts page: emails and phone numbers | staff contacts sit with the customer |

## Residual work on our side

- **Frontend, targeted fixes:** [#67](https://github.com/michaelwelly/MuseonUrania/issues/67)
  (UTPP membership: remove the link-through), [#70](https://github.com/michaelwelly/MuseonUrania/issues/70)
  (product image does not fit the screen), [#71](https://github.com/michaelwelly/MuseonUrania/issues/71)
  (caption and image in the Vedalina widget), [#73](https://github.com/michaelwelly/MuseonUrania/issues/73)
  (document buttons should link to actual files), [#74](https://github.com/michaelwelly/MuseonUrania/issues/74)
  (map on the contacts page), [#78](https://github.com/michaelwelly/MuseonUrania/issues/78)
  (footer: remove "Resuscitation" from "Equipment"), [#79](https://github.com/michaelwelly/MuseonUrania/issues/79)
  (admin logo should link to the site), [#62](https://github.com/michaelwelly/MuseonUrania/issues/62)
  (layout drifting on Mac: gather evidence and fix).
- **Assistant and CRM:** [#48](https://github.com/michaelwelly/MuseonUrania/issues/48)
  (authenticated Vedalina: search over internal documents),
  [#38](https://github.com/michaelwelly/MuseonUrania/issues/38) (RAG/pgvector
  to be finalized once the document corpus is ready), [#50](https://github.com/michaelwelly/MuseonUrania/issues/50)
  (replying to a visitor directly from the conversations widget), [#51](https://github.com/michaelwelly/MuseonUrania/issues/51)
  (on-duty roster: who is on the line today).
- **Infrastructure and operations:** [#37](https://github.com/michaelwelly/MuseonUrania/issues/37)
  (final upload of materials to object storage and access check),
  [#42](https://github.com/michaelwelly/MuseonUrania/issues/42) (MFA in
  Keycloak and a decision on `/admin` access), [#45](https://github.com/michaelwelly/MuseonUrania/issues/45)
  (move to the production contour), [#60](https://github.com/michaelwelly/MuseonUrania/issues/60)
  (Dependabot queue and PR #17), [#65](https://github.com/michaelwelly/MuseonUrania/issues/65)
  (DDoS protection on a single VM shared with another site).

---

## Important

The residual work listed in the two sections above is **not included** in
the completed scope recorded in sections 1-5 of this registry, and does
**not affect** its composition.
