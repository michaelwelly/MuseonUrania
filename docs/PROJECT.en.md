# VEDAL Portal — general documentation

[Русский](PROJECT.md) · **English**

The single entry point into the project. Everything else is detail; what is
collected here is what you need in order to make a decision or start work without
re-reading thirty-nine files.

**State as of 12 August 2026.** Verified against the code of the branches `front`
(`5ab20ef`), `dev` (`6262106`), `main` (`cb297e6`). The numbers in "Current state"
are the result of counting across the repository, not a retelling of documents.

---

## Contents

1. [What this project is](#1-what-this-project-is)
2. [Document hierarchy](#2-document-hierarchy)
3. [Repository map](#3-repository-map)
4. [Branches](#4-branches)
5. [How it is supposed to run](#5-how-it-is-supposed-to-run)
6. [Current state](#6-current-state)
7. [What is needed on the backend side](#7-what-is-needed-on-the-backend-side)
8. [What is needed on the frontend side](#8-what-is-needed-on-the-frontend-side)
9. [Rules that must not be broken](#9-rules-that-must-not-be-broken)
10. [Products and confirmed facts](#10-products-and-confirmed-facts)
11. [Contradictions between documents](#11-contradictions-between-documents)
12. [Open questions](#12-open-questions)
13. [Order of work](#13-order-of-work)
14. [Where to find what](#14-where-to-find-what)

---

## 1. What this project is

**VEDAL Portal** is not a website but a platform: a public storefront, a CRM and a
closed contour in a single architecture. The customer is OOO "VEDAL", a
manufacturer of medical equipment for neonatology, resuscitation, anesthesiology
and intensive care. The public website `vedal-med.ru` is the entry point into
sales, not a separate storefront.

Two contours and the gateway between them:

| Contour | What is inside | Who builds it |
| --- | --- | --- |
| **Open office** | mail on the domain, calendar, Telemost, Forms, Disk without secrets, wiki/tracker | bought — Yandex 360 |
| **DMZ / Integration Gateway** | lead intake, validation of the source and attachments, antivirus/DLP, manual approve, event queue, import/export audit | written by us |
| **Closed contour** | CRM, Document Vault, PostgreSQL as the source of truth, private object storage, Keycloak + MFA, VPN / Zero Trust, logs and backups | written by us, infrastructure bought |

The principle: we do not rewrite standard services, we keep unique logic to
ourselves.

**Not exposed outside:** the customer base, commercial terms, contracts,
invoices, margins, tokens, personal data.

**Infrastructure budget** — 50,000–80,000 ₽/month excluding development and
maintenance (Yandex 360 for 50 employees ≈ 27,450 ₽; VM, Managed PostgreSQL,
backups, object storage, logs, monitoring, Lockbox/WAF, EDI — the rest).

---

## 2. Document hierarchy

When documents disagree, seniority is as follows:

1. **The [owner brief](architecture/vedal_portal_owner_brief.en.md)** — the target
   architecture. It outranks the other documents, which is recorded in the root
   [README](../README.en.md).
2. **The [backend spec](superpowers/specs/2026-08-06-vedal-portal-architecture-design.en.md)** —
   how the brief is achieved technically. Eight implementation steps, decisions
   accepted and rejected.
3. **[backend/README](../backend/README.en.md)** and 11 module READMEs — what has
   already been built and what it stands on.
4. **[docs/products/README](products/README.en.md)** — the only product data
   confirmed by the customer (datasheets from 5 August).
5. Everything else is the frame and the requirements written before the technical
   decisions.

Three generations of documents, which explains the variance in language and
detail:

| Generation | When | Language | Files |
| --- | --- | --- | --- |
| Business frame | July 2026 | English | [project_brief](strategy/project_brief.en.md), [functional_requirements](strategy/functional_requirements.en.md), [roadmap](operations/roadmap.en.md), [infrastructure_architecture](architecture/infrastructure_architecture.en.md), [content_and_seo_plan](strategy/content_and_seo_plan.en.md), [competitor_notes](strategy/competitor_notes.en.md), [team_estimate](operations/team_estimate_7_people.en.md) |
| Frontend package | July 2026 | English | [sitemap](frontend/sitemap.en.md), [content_model](frontend/content_model.en.md), [page_briefs](frontend/page_briefs.en.md), [implementation_checklist](frontend/implementation_checklist.en.md), [frontend_design_handoff](strategy/frontend_design_handoff.en.md), [frontend_variants](strategy/frontend_variants.en.md), [urania_assistant_spec](strategy/urania_assistant_spec.en.md) |
| Technical truth | 6–11 August 2026 | Russian | [owner brief](architecture/vedal_portal_owner_brief.en.md), [spec](superpowers/specs/2026-08-06-vedal-portal-architecture-design.en.md), [backend/README](../backend/README.en.md) and the module ones, [catalog plan](superpowers/plans/2026-08-06-catalog-module.en.md) |

A measurement across 39 files: 18 were written 70–98% in Russian, 20 were 75–100%
English. There is almost no mixing inside a single file — this is a split between
generations. Bringing everything to a bilingual form (`ru`/`en` with a switcher
inside the file) is a separate task.

---

## 3. Repository map

```
MuseonUrania/
├─ docs/PROJECT.md          ← this file, the entry point
├─ frontend/                Next.js 16, App Router, TypeScript, CSS Modules
│  ├─ app/                  routes and global styles
│  ├─ components/           Header, Footer, LeadForm, UraniaChat/Widget, AnimatedLogo, VedalMap…
│  ├─ content/*.ts          ALL page text; unconfirmed facts marked «ожидает уточнения»
│  └─ lib/                  helpers (animations)
├─ backend/                 one Spring Boot application, one database
│  ├─ src/main/java/ru/vedal/portal/<module>/   ← all the code lives here
│  ├─ src/main/resources/db/migration/          ← Flyway, the single source of the schema
│  ├─ <module>/README.md    ← folders documenting module boundaries, no code inside
│  ├─ tools/seed-catalog.mjs   generator for the V2 migration from frontend/content/products.ts
│  └─ compose.yaml          PostgreSQL 16 (port 5434) + Kafka 3.9 in KRaft mode
├─ docs/
│  ├─ api/                  OpenAPI export for the public API (assembled from the code)
│  ├─ architecture/         owner brief, infrastructure
│  ├─ strategy/             business frame, requirements, Urania, SEO, competitors
│  ├─ frontend/             sitemap, content models, page briefs, checklist
│  ├─ operations/           roadmap, team estimate
│  ├─ products/             VEDAL R1/R2, A-2000, Т-100 datasheets and the analysis
│  ├─ requests/             the materials request to Nikolay Nikolaevich
│  └─ superpowers/          the backend spec, the catalog module plan
├─ assets/urania/           Urania avatars; MVP — urania-avatar-middle-v1.png
├─ prototypes/              urania-web-interface.html — the source of the markup
└─ outputs/                 presentations, pptx/pdf
```

**Important about the backend layout.** The folders `backend/crm/`,
`backend/iam/` and the rest are **not** Maven modules and contain no code. They
document boundaries. The code lives in the standard layout:
`backend/src/main/java/ru/vedal/portal/<module>/`.

Eleven modules:

| Module | Responsibility |
| --- | --- |
| [app](../backend/app/README.en.md) | Spring Boot assembly, configuration, entry point |
| [common](../backend/common/README.en.md) | shared types, errors, validation, outbox, rate limits |
| [iam](../backend/iam/README.en.md) | accounts, roles, access |
| [catalog](../backend/catalog/README.en.md) | products and categories, public API |
| [content](../backend/content/README.en.md) | news and press centre |
| [documents](../backend/documents/README.en.md) | documents, publication statuses, object storage |
| [gateway](../backend/gateway/README.en.md) | lead intake: validation, approve, handover to CRM |
| [crm](../backend/crm/README.en.md) | leads, customers, deals, quotes |
| [notifications](../backend/notifications/README.en.md) | customer letters and manager notifications |
| [assistant](../backend/assistant/README.en.md) | Urania: answers from published content, limits |
| [audit](../backend/audit/README.en.md) | log of actions and document access |

Deferred, with no folders yet: **knowledge** (internal AI search, stage 3 of the
roadmap) and **vlm** (visual models for service and manufacturing, a separate
pilot).

**Dependency rule:** a module never imports another module directly, only its
interface. `crm` knows `CatalogQuery`, not the internals of `catalog`. This is the
price for being able to extract a module into a separate service without
untangling a knot.

---

## 4. Branches

| Branch | Purpose |
| --- | --- |
| `main` | released, finished work only |
| `dev` | integration, everything is reviewed here |
| `front` | frontend, merges into `dev` |
| `back` | backend, merges into `dev` |
| `docs` | documentation, merges into `dev` |

The layered model is enforced by the `gitflow` skill — consult it before any git
operation rather than guessing from general practice.

**A known problem as of 12 August 2026:** `main` is 55 commits behind `dev`, so
`main` contains **zero Java files** — an outside observer sees a project made of
frontend and documents with no code. Meanwhile the local `front` is 39 commits
ahead of `origin/front`. The cure is merging `dev` → `main` and pushing `front`.

---

## 5. How it is supposed to run

### 5.1 Three doors and no more

We do not add a fourth: a new feature arrives into one of the three. Then the
perimeter is checked in three places rather than in thirty controllers.

| Door | Who calls it | Property |
| --- | --- | --- |
| `Public API` `/api/public/v1/*` | site build, Urania | read-only, published content only, cacheable |
| `Forms API` `/api/forms/v1/leads` | website forms, Yandex Form, mail parsing | **the single external write**, idempotency by `Idempotency-Key` |
| `Admin UI` `/admin/**` | employee | Thymeleaf + session, Spring Security; can be closed off entirely at the proxy |

Errors from every door are `application/problem+json` (RFC 9457), one format for
everything. The forms and the assistant have per-client rate limits.

### 5.2 The path of a lead

It also defines the module boundaries.

```
Lead (website, form, mail)
  → gateway         checks the source, the fields and the attachments
  → crm             creates a draft lead without access to closed data
  → crm             deal, quote, documents, statuses inside the portal
  → notifications   only a templated letter goes outside
```

Every step writes to `audit`.

### 5.3 Five properties we measure stability by

1. **A backend outage does not take the website down.** The catalog, the news and
   the documents are baked into static files at build time. A live backend is
   needed only by the forms and by Urania.
2. **The schema changes only through migrations.** A manual `ALTER` in production
   is forbidden: after it a dump restores into a schema that is not in the
   history.
3. **Only published content goes outside.** This is a property of the query, not
   of the editor's discipline.
4. **A lead is never lost.** The database write and the event are committed in one
   transaction.
5. **One door for external writes.** The validation rule is written once.

### 5.4 Four ports to the outside

The domains never look behind a port; changing the implementation is a matter of
configuration.

| Port | Now | Later |
| --- | --- | --- |
| `EventPublisher` | log by default, Kafka with `vedal.events.publisher=kafka` | Managed Kafka |
| `MailSender` | writes to the log | Yandex 360 SMTP |
| `FileStorage` | local directory `var/documents` | Yandex Object Storage |
| `LlmEngine` | deterministic word search | YandexGPT + pgvector |

Signed links and privacy are a property of `FileStorage`, not of the calling code.
Moving to S3 cannot accidentally expose a closed file.

### 5.5 Events

A transactional outbox: the entity row and the event row are committed by a single
`COMMIT`, and a separate relay reads the outbox and publishes. Publishing directly
from a handler is forbidden — between the `INSERT` and the send there is a gap
that leads fall into.

| Topic | Who writes | Who reads |
| --- | --- | --- |
| `vedal.leads.v1` | `crm` | letters, audit |
| `vedal.documents.v1` | `documents` | indexing, audit |
| `vedal.notifications.v1` | `notifications` | sending |
| `vedal.audit.v1` | everyone | writing the log |

The partitioning key is the entity identifier: events of one lead do not get
reordered. Consumers are idempotent. Anything still unprocessed after retries goes
to the DLQ and is handled manually, otherwise one broken PDF stops the conveyor.
Kafka is not the source of truth and is not backed up: everything in the topics
originates from the outbox.

### 5.6 Data

**One database.** Separate databases are not part of the architecture — this
follows directly from the transactional outbox. Separate databases exist in one
sense only: one per environment.

Key tables:

```
category          id, slug, name, position
product           id, slug, name, kind, summary, detail, doc_status, published,
                  sort_order, image_src, image_alt, created_at, updated_at
product_category  product_id, category_id
product_spec      id, product_id, kind, position, label, value, muted
outbox            id, aggregate, aggregate_id, type, payload, created_at, published_at
audit_entry       id, at, actor, action, subject, subject_id, correlation_id, ip, payload
lead              id, form, name, company, phone, email, product_slug, message,
                  consent_version, consent_at, source, status, owner,
                  correlation_id, idempotency_key, created_at
```

`doc_status` (`confirmed | pending`) and `published` are **different** flags. The
first means "the specifications are confirmed by a datasheet" and draws a badge on
the site, the second means "visible outside". Collapsing them into one removes half
the catalog from the site.

The catalog is filled by the `V2__catalog_seed.sql` migration, which is
**generated** from `frontend/content/products.ts` rather than written by hand:

```bash
node backend/tools/seed-catalog.mjs > backend/src/main/resources/db/migration/V2__catalog_seed.sql
```

Editing `V2` by hand is pointless — regenerate and commit it again.

### 5.7 What is enforced by database constraints rather than code

Rules that cannot be bypassed by editing a controller or by an editor's mistake:

- `document_public_only` — an internal or confidential document cannot become publicly downloadable;
- `document_published_has_file` — publishing without an uploaded file is forbidden;
- `document_published_is_listed` — a published document must appear in the listing;
- `lead_idempotency_key_idx` — resubmitting a form does not create a second lead;
- `event_consumed_idx` — a redelivered event does not produce a second letter;
- `news_published_needs_date` — a published news item must have a date;
- the `audit_entry_append_only` trigger — the log cannot be edited retroactively.

The trigger does not protect against `TRUNCATE`. The real protection is revoking
`UPDATE`/`DELETE`/`TRUNCATE` from the application role during environment setup.

### 5.8 Environments and running it

Environments: `prod`, `staging`, `internal`, `lab`. In `lab` — non-secret data
only. In deployed profiles the connection is configured **only** through
environment variables, with no development defaults: a production instance that
silently came up on the development database is worse than one that did not come
up at all. The check runs before the datasource is created and names the missing
variables one by one.

JDK 25 and PostgreSQL 16 are required; Maven does not have to be installed, the
wrapper is in the repository.

```bash
docker compose -f backend/compose.yaml up -d
```

```bash
cd backend && ./mvnw spring-boot:run
```

The application comes up on `http://localhost:8081` (not 8080 — that port is taken
on the development machine). The schema is owned by Flyway alone, migrations are
applied on start. The first administrator is created only if both
`VEDAL_ADMIN_USER` and `VEDAL_ADMIN_PASSWORD` are set, otherwise the account
simply does not exist.

The tests run against a real PostgreSQL through Testcontainers and **require a
running Docker**. H2 is not used: dialect differences should surface here, not in
production.

```bash
cd backend && ./mvnw test
```

Frontend:

```bash
cd frontend && npm run dev
```

### 5.9 Perimeter, observability, backups

The application sits behind a reverse proxy. Without
`server.forward-headers-strategy=framework` and a list of trusted proxies the rate
limit counts all visitors as one client and the audit log records the proxy
address instead of the user's. The body size limit on the proxy is aligned with
document uploads, otherwise a PDF fails with 413 before reaching the application.

A VPN is a perimeter, not authorization. Sign-in, roles and audit in the admin
panel are needed regardless of whether it is closed off at the network level.

**The main monitoring signal is the outbox lag.** The relay stopped: the
application is green, forms are accepted, users see "thank you", leads pile up and
go nowhere. The alert is records older than 5 minutes. The second signal: the last
successful backup is older than a day. Personal data is not written to the logs,
only the `correlation_id` and the lead identifier — otherwise the logging system
also becomes a store of personal data.

The target backup scheme: continuous WAL through `wal-g` into object storage, a
full backup once a week, an encrypted `pg_dump -Fc` into a bucket of another
account, bucket versioning, a service account with write-only permissions. A
monthly check: the latest dump is restored into a separate database, the
migrations are run and the row counts are compared. A backup that has never been
restored is a hypothesis.

### 5.10 Personal data

The forms collect a name, a phone number and an email. Consequences: store not a
checkbox but the **version of the consent text** and the time (a year later there
is no other way to prove what exactly the person agreed to); a retention period
and automatic cleanup (preliminarily 3 years, awaiting confirmation); deletion
upon request; infrastructure in Russia.

---

## 6. Current state

### 6.1 Backend — working

97 Java files, 16 test classes, 11 Flyway migrations, 9 controllers, 12 catalog
items in the seed, 5 categories. Spring Boot 4.1.0 on Spring Framework 7, Java 25,
Jackson 3, PostgreSQL 16, Testcontainers.

Seven of the eight implementation steps are closed: `catalog` → `content` →
`crm` + Forms API → `notifications` → `documents` → Kafka (publishing) →
`assistant`.

Working routes:

| Route | Who calls it | What it does |
| --- | --- | --- |
| `GET /actuator/health` | monitoring | liveness; the other endpoints are closed |
| `GET /api/public/v1/categories` | site build | catalog categories |
| `GET /api/public/v1/products` | site build | published items only, `Cache-Control: max-age=300` |
| `GET /api/public/v1/products/{slug}` | site build | product page; unpublished returns 404 |
| `GET /api/public/v1/news` | site build | the feed; empty is `[]`, not an error |
| `GET /api/public/v1/news/{slug}` | site build | a publication; unpublished returns 404 |
| `GET /api/public/v1/documents` | site build | the listing; the file link only for published ones |
| `GET /api/public/v1/documents/{slug}/file` | visitor | the file; closed returns 404 and the request is logged |
| `POST /api/forms/v1/leads` | website forms | lead intake, `Idempotency-Key`, `202` response |
| `POST /api/assistant/v1/ask` | Urania | an answer from published content with links |
| `GET /admin/products` | employee | catalog: editing and publishing |
| `GET /admin/news` | employee | news: creating, editing, publishing |
| `GET /admin/documents` | employee | documents: file upload and publication |
| `GET /admin/leads` | employee | leads |

A note on `assistant`: the limits live in `Guardrails` **before** the engine is
called, not in the prompt — a prompt is a request to the model, not a guarantee.
Closed materials are physically unreachable: `LlmEngine` only goes through
`CatalogQuery`, `ContentQuery` and `DocumentQuery`, and those return published
items exclusively. The assistant cannot be talked into showing a closed file
because the file is not in the context. No suitable sources means no answer —
there is a handoff to a human.

### 6.2 Frontend — working, but static

Next.js 16.3.0, React 19.2.8, App Router, TypeScript, CSS Modules, no external
dependencies besides Next and React.

Nine routes: `/`, `/products`, `/products/[slug]`, `/production`, `/documents`,
`/news`, `/service`, `/about`, `/contacts`. Twelve product cards (R1 and R2 share
one), five categories, animations, a preloader, an animated VEDAL mark, a map,
tabs on the product page. All the text lives in `content/*.ts`, with unconfirmed
facts marked «ожидает уточнения».

### 6.3 The main gap

**There is not a single network call in the frontend.** Searching for `fetch(`,
`/api/` and `NEXT_PUBLIC` produces no matches.

- `LeadForm.tsx` — client-side validation only, `onSubmit` sends nothing anywhere;
- `UraniaChat.tsx` — canned answers from `content/urania.ts`, `/api/assistant/v1/ask` is never called;
- `FooterSubscribe.tsx` — the same;
- the catalog, the news and the documents are read from `content/*.ts`, not from the Public API.

This is recorded in
[backend/gateway/README](../backend/gateway/README.en.md) as well: "the frontend
forms are already built but have nowhere to send to". Both halves were written
against the same spec, but there is not a single wire between them. **This is work
item number one.**

---

## 7. What is needed on the backend side

| # | What | State and pitfalls |
| --- | --- | --- |
| 1 | Merge `dev` → `main`, push `front` | 55 and 39 commits respectively; from outside the project looks like documents without code |
| 2 | Finish step 6: consumers read **from topics** | for now they live in-process through `DomainEventConsumer`, with repeats cut off by `(consumer, event)`; the consumer shape is already the one a topic consumer will have. A DLQ is needed |
| 3 | **Keycloak + MFA** instead of local accounts | a decision from the owner brief; currently Spring Security with local accounts sits behind the `iam` interface. The identity provider is bought; `iam` keeps the role model and the link between an account and an employee |
| 4 | Decide where the object storage lives and implement `FileStorage` on it | an open question in two documents at once; on the owner's diagram it is "Private Object Storage" inside the closed contour |
| 5 | Grow `crm` to full: customers, deals, quotes, statuses, owner, dealer and service funnels, correspondence history, attachments from approved documents, analytics by product/source/language/campaign | currently only lead intake |
| 6 | `MailSender` → Yandex 360 SMTP | letters still go to the log |
| 7 | `LlmEngine` → YandexGPT + pgvector, the pipeline text extraction → chunks with metadata → embeddings | **pitfall:** the EnterpriseDB PostgreSQL build for Windows does not ship pgvector. A `pgvector/pgvector:pg16` image is needed, and `compose.yaml` and `PostgresTestBase` must be switched **at the same time**, otherwise the tests diverge from development |
| 8 | Step 8 — the move: VM, Managed PostgreSQL, Managed Kafka, Object Storage, backups, monitoring | depends on Yandex Cloud, which does not exist yet |
| 9 | Perimeter: `forward-headers-strategy`, trusted proxies, body size limit | without these the rate limit and the audit log break |
| 10 | CI: a build with tests and an image, graceful shutdown, rollback by returning to the previous image | there is no deployment at all right now |
| 11 | `ETag` on the public API | deliberately deferred: on twelve items the gain is zero and `Cache-Control` is already in place |

---

## 8. What is needed on the frontend side

| # | What | Details |
| --- | --- | --- |
| 1 | An API client plus `NEXT_PUBLIC_API_URL`, reading the catalog, news and documents through the Public API at build time | static stays static — property #1 must not break |
| 2 | `LeadForm` → `POST /api/forms/v1/leads` | `Idempotency-Key` (a uuid per form mount), the consent text version and time, a honeypot, success/error states, handling `202` |
| 3 | `UraniaChat` → `POST /api/assistant/v1/ask` | render the list of sources; when there are none, show the handoff to a human with contacts and forms rather than an invented answer |
| 4 | Bring the routes in line with the sitemap | [sitemap](frontend/sitemap.en.md) requires `/press/` (Innoprom) and `/partners/` (Divisy, Morus MS, Smart Solution) — neither exists; `/news` was built instead of `/press`, and an unplanned `/about` was added. Either build them or update the map |
| 5 | The product page from the API plus the list of documents per product | currently from `content/products.ts` |
| 6 | SEO: the metadata API, `sitemap.xml`, `robots.txt`, JSON-LD Product/Organization, canonical URLs | priority: `/products/`, `/products/<slug>/`, `/production/`, `/documents/` |
| 7 | Yandex Metrica and the named events | the list is ready in the [implementation checklist](frontend/implementation_checklist.en.md): `hero_quote_click`, `hero_catalog_click`, `product_card_open`, `product_quote_click`, `document_download_click`, `urania_open`, `urania_quick_action_click`, `service_form_submit`, `quote_form_submit`, `catalog_form_submit` |
| 8 | The multilingual skeleton `/en/`, `/zh/`, hreflang | content follows the approval of the Russian version; Hindi is a separate stage |
| 9 | Consent text before submitting any form, accessible forms and buttons | a Safety QA item, currently not covered |

---

## 9. Rules that must not be broken

They apply to the website, the admin panel and Urania alike:

- do not invent **prices**;
- do not invent **specifications**;
- do not invent **certificates or registration status**;
- do not invent **delivery times or availability**;
- do not publish **clinical claims** without approval;
- do not expose **internal or confidential documents**;
- Urania **does not diagnose and does not recommend treatment**, and does not
  promise a device's suitability for a clinical case without specialist review;
- missing data is **«ожидает уточнения»**, never a plausible invention;
- a questionable or sensitive question ends in a **handoff to a human**.

Visual rules: Urania is visible but secondary to the product and production
message; Smart Solution is secondary to VEDAL; restrained medical B2B with no
oversized marketing headlines and no decorative gradients.

---

## 10. Products and confirmed facts

Datasheets on company letterhead were received from the customer on **5 August
2026** — the first confirmed product data in the project. The analysis is in
[docs/products/README](products/README.en.md).

| Product | Category | Data status |
| --- | --- | --- |
| VEDAL R1, R2 — neonatal resuscitation system | resuscitation, neonatology | datasheet confirmed |
| VEDAL A-2000 — transformable incubator | neonatology, intensive care | datasheet confirmed |
| VEDAL Т-100 — thermoregulation system | neonatology, intensive care | datasheet confirmed |
| VV11, VP4, VN10, N6, N12, N15, N1, N2, N3 | ventilation, anesthesia, monitoring, neonatology | from the public website, no datasheets |

Catalog categories: neonatology, resuscitation, anesthesiology, monitoring,
intensive care.

Company details from the letterhead (confirmed, safe to use):

- ООО «ВЕДАЛ», 620135, Sverdlovsk region, Yekaterinburg, ul. Sovkhoznaya, bldg. 20В
- ИНН/КПП 5406826069/540601001
- 8-800-600-3449, +7 922 204 75 30
- sales@vedal-med.ru

**Still open:** registration and certification status for every item; product
photographs as separate files (the PDFs contain illustrations, but those are not
assets); the final list of items for the first release; whether the Т-100
indications for use may be published in the manufacturer's wording. There are no
prices in the datasheets, which matches the rule.

---

## 11. Contradictions between documents

They are recorded in the documents themselves as unresolved. They need a decision,
not an on-the-spot choice.

| What | Version A | Version B |
| --- | --- | --- |
| Employee count | 50 — [owner brief](architecture/vedal_portal_owner_brief.en.md) | 60 — [functional_requirements](strategy/functional_requirements.en.md), [infrastructure_architecture](architecture/infrastructure_architecture.en.md) |
| Message broker | Kafka — [spec](superpowers/specs/2026-08-06-vedal-portal-architecture-design.en.md) | Redis/RabbitMQ for indexing jobs — [infrastructure_architecture](architecture/infrastructure_architecture.en.md) |
| CRM | our own, inside the portal — owner brief | Bitrix24 / amoCRM / Yandex Tracker — an "open question" in infrastructure_architecture |
| Number of products | "about 10" — the brief | 13 names in functional_requirements, 12 cards in the code, 3 confirmed by datasheets |
| Corporate stack | Yandex 360 + Yandex Cloud + Managed PostgreSQL — decided in the brief | Yandex vs Google vs Kontur still being compared — infrastructure_architecture |

Until the broker discrepancy is resolved, `EventPublisher` stays a port: changing
the broker will not touch a single domain.

---

## 12. Open questions

**To the owner / Nikolay Nikolaevich:**

1. Do we build the CRM inside VEDAL Portal?
2. Which data is forbidden to store in Yandex 360?
3. Who gets access to the CRM at the first stage?
4. Is an integration with 1C/Kontur needed right away?
5. Registration and certification status for each item.
6. The final product list for the first release and the priority order.
7. Which documents may be published and which stay in the internal contour only.
8. Photos and video of products, manufacturing and the exhibition stand — a link
   to the cloud folder.
9. The Innoprom materials.
10. The domain: `vedal-med.ru` or another option.
11. Whether Yandex Metrica may be installed on the public website.
12. Whether the assistant may be publicly called Urania and shown in the hero.

**Technical, awaiting confirmation:**

1. Acceptable data loss and time to recovery — 5 minutes and 1 hour proposed.
2. Lead retention period — 3 years proposed.
3. Whether `/admin` is closed at the network level or left behind a password and MFA.
4. Where the object storage lives.
5. When Keycloak is introduced.

---

## 13. Order of work

1. **Merge `dev` → `main`, push `front`.** Cheap, and it removes the impression of
   a dead repository with no code.
2. **Connect the frontend to the backend** — forms, Urania, catalog from the API.
   Both halves are ready, the wire is missing.
3. **Bilingual documents** — `ru`/`en` mirrored with a switcher inside the file,
   and the rule "a new .md is created in both versions at once".
4. **Keycloak**, following a working implementation in a third-party `api-gateway`
   (the repository is private, access is needed).
5. Object storage, the full CRM, YandexGPT + pgvector, the move to Yandex Cloud.

The full roadmap is [operations/roadmap.en.md](operations/roadmap.en.md): stage 0
(collecting materials) → 1 (public MVP) → 2 (corporate contour) → 3 (AI search) →
4 (multilingual) → 5 (VLM for manufacturing and service).

---

## 14. Where to find what

| You need | File |
| --- | --- |
| Target architecture, contours, budget | [architecture/vedal_portal_owner_brief.en.md](architecture/vedal_portal_owner_brief.en.md) |
| Technical decisions, accepted and rejected | [superpowers/specs/2026-08-06-vedal-portal-architecture-design.en.md](superpowers/specs/2026-08-06-vedal-portal-architecture-design.en.md) |
| What is built on the backend, how to run it, the ports | [../backend/README.en.md](../backend/README.en.md) |
| The public API contract: entry points, forms, entities, errors | [api/README.en.md](api/README.en.md), [api/vedal-openapi.yaml](api/vedal-openapi.yaml) |
| The boundaries of a specific module | `backend/<module>/README.en.md` |
| How to run the frontend, content rules | [../frontend/README.en.md](../frontend/README.en.md) |
| Site structure and routes | [frontend/sitemap.en.md](frontend/sitemap.en.md) |
| Data models for page, product, document, form, assistant | [frontend/content_model.en.md](frontend/content_model.en.md) |
| What each page must contain | [frontend/page_briefs.en.md](frontend/page_briefs.en.md) |
| Acceptance checklist and analytics events | [frontend/implementation_checklist.en.md](frontend/implementation_checklist.en.md) |
| Urania's rules and limits | [strategy/urania_assistant_spec.en.md](strategy/urania_assistant_spec.en.md) |
| The full business requirements | [strategy/functional_requirements.en.md](strategy/functional_requirements.en.md) |
| Stages and timelines | [operations/roadmap.en.md](operations/roadmap.en.md) |
| Infrastructure phases and open questions | [architecture/infrastructure_architecture.en.md](architecture/infrastructure_architecture.en.md) |
| Confirmed product data and company details | [products/README.en.md](products/README.en.md) |
| What was requested from the customer | [requests/nikolay_materials_request.en.md](requests/nikolay_materials_request.en.md) |
| Design direction and the three variants | [strategy/frontend_design_handoff.en.md](strategy/frontend_design_handoff.en.md), [strategy/frontend_variants.en.md](strategy/frontend_variants.en.md) |
| SEO and multilingual planning | [strategy/content_and_seo_plan.en.md](strategy/content_and_seo_plan.en.md) |
| Competitors and partners | [strategy/competitor_notes.en.md](strategy/competitor_notes.en.md) |
| The customer presentation | [strategy/nn_presentation_outline.en.md](strategy/nn_presentation_outline.en.md) |
| The detailed catalog module plan (a template for the next ones) | [superpowers/plans/2026-08-06-catalog-module.en.md](superpowers/plans/2026-08-06-catalog-module.en.md) |
| Documentation rules, the glossary | [documentation_rules.en.md](documentation_rules.en.md) |

---

## How to maintain this document

It is an overview and it goes stale first. The rule: if a **decision** changes
(architecture, stack, module boundaries, release scope) — this file is edited. If
an **implementation** changes inside an already-described decision — the README of
the corresponding module is edited, and only a line in "Current state" comes here.

The numbers in section 6 were obtained by counting across the repository — when
updating, recount them rather than rewriting them from memory.
