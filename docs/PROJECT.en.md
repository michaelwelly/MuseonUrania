# VEDAL Portal — general documentation

[Русский](PROJECT.md) · **English**

The single entry point into the project. Everything else is detail; what is
collected here is what you need in order to make a decision or start work without
re-reading thirty-nine files.

**State as of 14 August 2026.** Verified against the code of the `dev` branch
after the `back`, `front`, `infra` and `docs` layers were merged in. The numbers in
"Current state" are the result of counting across the repository, not a retelling
of documents.

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
│  ├─ app/(site)/           the public site: nine routes
│  ├─ app/(admin)/          the admin UI: dashboard, products, categories, news,
│  │                        documents, audit log; CRM — leads, clients, deals,
│  │                        quotes, analytics. Its own root layout — the site's
│  │                        chrome does not leak into it
│  ├─ components/           Header, Footer, LeadForm, UraniaChat/Widget, AnimatedLogo, VedalMap…
│  ├─ content/*.ts          ALL page text; unconfirmed facts marked «ожидает уточнения»
│  ├─ lib/api.ts            public API: read at build time
│  ├─ lib/admin.ts          admin API: browser only, token only
│  ├─ lib/auth.ts           Keycloak sign-in, authorization code with PKCE
│  └─ Dockerfile            pages are built when the container starts, not the image
├─ backend/                 a 12-module Maven reactor + a separate gateway, one database
│  ├─ pom.xml               the reactor root: the module list and shared versions
│  ├─ <module>/pom.xml      ← each has its own pom: dependencies declared and checked
│  ├─ <module>/src/main/java/ru/vedal/portal/<module>/  ← the module's code
│  ├─ <module>/README.md    ← purpose, boundaries, what it depends on
│  ├─ app/                  the only module that becomes an application: entry point,
│  │                        configuration, the Flyway schema, application tests
│  ├─ app/src/main/resources/db/migration/   ← Flyway, the single source of the schema
│  ├─ api-gateway/          a separate application outside the reactor: the single entry point
│  ├─ keycloak/             the local stack's realm + a README on the two addresses
│  ├─ debezium/             the outbox → Kafka connector + the settings walkthrough
│  ├─ tools/seed-catalog.mjs   generator for the V2 migration from frontend/content/products.ts
│  ├─ Dockerfile            the portal's image
│  └─ compose.yaml          the whole stack: PostgreSQL 16 with wal_level=logical,
│                           Kafka 3.9 in KRaft, MinIO, Keycloak, Kafka Connect;
│                           profile `app` adds the portal, the gateway and the site
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
`backend/iam/` and the rest are **real Maven modules**: their own `pom.xml`,
their own `src/`, their own README. Until 14 August 2026 they merely documented
boundaries while the code sat in one heap under `backend/src/`; the boundaries
rested on attentiveness and the build knew nothing about them.

It knows now. A module reaching into a neighbour's guts fails compilation — not
review, but `mvnw`. The formula is the one the client asked for: "like
microservices, but like a monolith". The boundary lives in the build, the
process stays single, and the transactional outbox is intact: the entity row and
the event row commit in one `COMMIT`, because the database and the transaction
are shared.

Eleven modules plus `app`, which assembles them:

| Module | Responsibility |
| --- | --- |
| [app](../backend/app/README.en.md) | Spring Boot assembly, configuration, entry point |
| [common](../backend/common/README.en.md) | shared types, errors, validation, outbox, rate limits |
| [iam](../backend/iam/README.en.md) | accounts, roles, access |
| [catalog](../backend/catalog/README.en.md) | products and categories, public API |
| [content](../backend/content/README.en.md) | news and press centre |
| [documents](../backend/documents/README.en.md) | documents, publication statuses, object storage |
| [gateway](../backend/gateway/README.en.md) | lead intake: validation, approve, handover to CRM |
| [crm](../backend/crm/README.en.md) | leads, clients, deals, quotes, correspondence history, funnel analytics |
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

Half of that rule is now checked by the build: what is absent from a module's
`pom.xml` is invisible to it. The other half — "only the interface" — still rests
on people: `gateway` declares a dependency on the whole of `crm` and could reach
`LeadRepository`. Separating that fully would mean splitting every module into
`-api` and an implementation; deliberately not done yet — twenty-two artifacts
instead of twelve for a rule nobody has broken.

The dependency graph is a DAG without a single cycle:

```
common, iam → (никого)
audit → common
catalog, content, documents → common, audit
crm → common, audit, documents
gateway, notifications → common, crm
assistant → common, audit, catalog, content, documents
admin → common, audit, catalog, content, crm, documents
app → всё вышеперечисленное
```

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
| `Admin API` `/api/admin/v1/**` | employee | JSON, Keycloak token, roles `portal-admin` and `portal-editor`. The door is single, so restricting it at the proxy takes one rule — **but no such rule is in the [Caddyfile](../backend/proxy/Caddyfile) today**, and it is open to the internet |

The employee door changed shape rather than being created anew: instead of
server-rendered Thymeleaf pages it is JSON, with the Next.js admin UI on top.
The pages are gone, and with them the portal has **no browser-facing page at
all** — which means no login form, no cookie session, and no CSRF token to
protect. That removed a whole class of risk rather than shortening the code: the
ambient authority cross-site request forgery relies on cannot exist when there is
no session. `AdminAccessTest` guards that state — a controller with a browser
page coming back will fail the build.

Errors from every door are `application/problem+json` (RFC 9457), one format for
everything. The forms and the assistant have per-client rate limits.

**A gateway stands in front of the doors.** `backend/api-gateway/` is a separate
Spring Cloud Gateway application, the single entry point `http://localhost:8080`.
The main gain is not routing: the site and the API end up on one origin, and CORS
drops out of the perimeter entirely — a browser does not make a cross-origin
request when the domain is the same. The body limit and token verification also
move into one place.

It does not, however, provide trust: the portal verifies the token itself and
refuses a request that arrived bypassing the gateway. The gateway is a filter,
not a trust boundary.

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
| `EventPublisher` | log, Kafka or Debezium — via `vedal.events.publisher` | Managed Kafka |
| `MailSender` | writes to the log | Yandex 360 SMTP |
| `FileStorage` | local directory or S3 — via `vedal.storage.kind`; MinIO in the stack | Yandex Object Storage |
| `LlmEngine` | deterministic word search | YandexGPT + pgvector |

Privacy is a property of `FileStorage`, not of the calling code, and it is
anchored to the storage area: `DOCUMENTS` lives in a closed bucket and is served
only through the controller that checks publication and records the access in the
audit log, while `MEDIA` lives in a read-open one and is served bypassing the
application. Separating them by buckets rather than folders is mandatory: an S3
access policy is set per bucket, and a private folder inside a public bucket is a
public folder.

Signed links are deliberately not used: an issued link lives until it expires,
survives the document being unpublished, and access through it does not reach the
audit log.

The file limit is 20 MB. The real check sits in multipart parsing, that is,
before the body reaches the heap; the check in the storage is a second line. The
same number is aligned with the gateway's body limit and with
`client_max_body_size` on the proxy: a smaller limit further up the chain drops
the upload with a 413 before the application, and the editor sees the proxy's
page instead of a clear refusal.

### 5.5 Events

A transactional outbox: the entity row and the event row are committed by a single
`COMMIT`. Publishing directly from a handler is forbidden — between the `INSERT`
and the send there is a gap that leads fall into.

Who reads the outbox is a matter of the `vedal.events.publisher` setting:

| Value | Publishing | Delivery to consumers |
| --- | --- | --- |
| `log` | the event goes to the log | in process |
| `kafka` | the relay polls the table and publishes itself | in process |
| `debezium` | a connector reads the PostgreSQL write-ahead log | from the topics |

The stack runs `debezium`. Nobody polls the table: events leave right after
`COMMIT`, latency stops depending on the poll interval, and there are no idle
queries against the database at all. It requires `wal_level=logical` and a
running Kafka Connect — the settings walkthrough is in
[backend/debezium/README.en.md](../backend/debezium/README.en.md).

In this mode `published_at` is stamped by the **consumer**, not by the relay.
That changes the meaning of the primary monitoring signal for the better: the lag
measures the whole path `COMMIT` → log → connector → topic → consumer, rather
than what the application managed to put on the queue.

| Topic | Who writes | Who reads |
| --- | --- | --- |
| `vedal.leads.v1` | `crm` | letters, audit |
| `vedal.deals.v1` | `crm` | no consumer yet, audit |
| `vedal.documents.v1` | `documents` | indexing, audit |
| `vedal.notifications.v1` | `notifications` | sending |
| `vedal.audit.v1` | everyone | writing the log |

Deals and quotes were given their own topic rather than mixed into leads: they
have a different life cycle and different consumers — a lead produces a letter
to the client, while a deal lives for weeks and matters to reporting.
`vedal.deals.v1` has no consumer yet: the letter carrying the quote itself
depends on Яндекс 360 SMTP.

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
                  consent_version, consent_at, source, language, campaign,
                  status, owner, correlation_id, idempotency_key, created_at
client            id, name, kind, inn, kpp, external_id, country, city,
                  email, phone, note, owner, version, created_at, updated_at
deal              id, client_id, lead_id, pipeline, title, stage, amount,
                  currency, product_slug, owner, closed_at, lost_reason,
                  version, created_at, updated_at
quote             id, deal_id, number, status, currency, valid_until, note,
                  total, sent_at, decided_at, version, created_at, updated_at
quote_item        id, quote_id, position, product_slug, name, quantity,
                  unit_price, amount
interaction       id, deal_id, client_id, lead_id, kind, direction, at,
                  subject, body, actor, created_at
deal_document     deal_id, document_id, attached_by, attached_at
```

`language` and `campaign` on a lead are not decoration: without them two of the
four analytics dimensions ("by language", "by campaign") cannot be computed at
all. They live on the lead rather than the deal because they are a property of
where the person came from, not of how they were worked with afterwards.

Three pipelines share one `deal` table with different sets of stages rather
than three tables: they share the card, the owner, the history and the
analytics. The set of stages is enforced by the `deal_stage_check` constraint.

`interaction` is the only CRM table without a `version` column, and that is a
decision: history is append-only. A correspondence entry that can be corrected
after the fact stops being history exactly when it is needed.

`doc_status` (`confirmed | pending`) and `published` are **different** flags. The
first means "the specifications are confirmed by a datasheet" and draws a badge on
the site, the second means "visible outside". Collapsing them into one removes half
the catalog from the site.

The catalog is filled by the `V2__catalog_seed.sql` migration, which is
**generated** from `frontend/content/products.ts` rather than written by hand:

```bash
node backend/tools/seed-catalog.mjs > backend/app/src/main/resources/db/migration/V2__catalog_seed.sql
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
- `deal_stage_check` — a deal's stage must belong to its own pipeline;
- `deal_lead_idx` — a lead is converted into a deal exactly once;
- `client_inn_idx` — a second card with the same ИНН would split one
  organisation's history across two places;
- `quote_sent_has_date` — a sent quote must remember when it was sent;
- `interaction_has_subject` — a history entry is attached to a deal, a client
  or a lead rather than hanging in the air;
- the `audit_entry_append_only` trigger — the log can be neither edited
  retroactively, nor deleted row by row, nor emptied wholesale;
- the `version` column on products, news items, documents, clients, deals and
  quotes — two editors who opened the same card do not silently overwrite each
  other.

One constraint is **deferred** — `quote_item_position_unique`
(`deferrable initially deferred`). That is not a relaxation: quote lines are
replaced wholesale, and in a single flush Hibernate inserts the new row before
deleting the old one. Checking at `COMMIT` keeps the rule strict and removes
the dependency on statement order inside the transaction.

The version is checked twice, and that is not belt-and-braces. The explicit check
in the domain catches the common case: the card was opened in the morning and
saved in the evening, and somebody else edited it in between. `@Version` catches
a genuine concurrent write by two transactions — without the explicit check it
would never fire, because the version is read from the database inside the same
transaction and always matches itself. Both cases surface as a `409` with an
explanation: for the editor it is one and the same situation.

**What used to be written here about `TRUNCATE` was wrong.** The belief was that
a trigger does not help because statement triggers do not fire on `TRUNCATE`.
They do: PostgreSQL supports `BEFORE TRUNCATE ... FOR EACH STATEMENT`, and such
a trigger stops the statement. Verified on PostgreSQL 16 and pinned by the test
`AuditLogTest.journalRejectsTruncate`.

The `V15__least_privilege.sql` migration puts both measures in place, and they
close different things:

| Measure | What it holds against | What limits it |
| --- | --- | --- |
| the `audit_entry_no_truncate` trigger | a typo in a console, an injection into a query, an extra line in a script | bypassed by an explicit `ALTER TABLE ... DISABLE TRIGGER` |
| revoking `UPDATE`/`DELETE`/`TRUNCATE` from the application role | the same things, at the level of privileges rather than one table | **does not bind a superuser at all** |

The second limitation is not a detail but a deployment requirement. The
`postgres` image creates `POSTGRES_USER` as a superuser, and a superuser does not
fail a privilege check — it does not undergo one. In the local stack and in the
tests the revoke is therefore decorative, and the log is held by the trigger
alone. **In a deployed environment the application role must be an ordinary
one** — otherwise everything above is written in vain.

`TRUNCATE` is revoked not only on the log but on every table: the application
never empties any of them wholesale. The revoke covers the tables that existed
at `V15`; a table from the next migration comes with full owner rights again, and
`ALTER DEFAULT PRIVILEGES` does not change that — an owner's rights are implied,
not granted. So a `revoke` line has to be added to every migration that creates
a table, and `LeastPrivilegeTest` makes forgetting it impossible: otherwise the
difference between "`TRUNCATE` is revoked" and "revoked except for three tables
added in September" would be visible from nowhere.

Left open: the application connects to the database as the schema owner, that is,
as the same role Flyway runs migrations with. An owner grants revoked rights back
to itself in one line. Real separation is a dedicated runtime role, neither a
superuser nor the owner; it touches `compose.yaml`, `compose.prod.yaml`,
`.env.example` and `PostgresTestBase`.

### 5.8 Environments and running it

Environments: `prod`, `staging`, `internal`, `lab`. In `lab` — non-secret data
only. In deployed profiles the connection is configured **only** through
environment variables, with no development defaults: a production instance that
silently came up on the development database is worse than one that did not come
up at all. The check runs before the datasource is created and names the missing
variables one by one.

JDK 25 and Docker are required; Maven does not have to be installed, the wrapper
is in the repository.

**On a clean machine — one command.** Docker is all you need: the script checks
it, generates `backend/.env` with random passwords, builds the images, waits for
readiness and prints the addresses and the account. The first run takes about ten
minutes, later ones take seconds.

```bash
./scripts/up.sh
```

On Windows without bash — the same thing:

```
.\scripts\up.ps1
```

Underneath it is the same compose command, which can also be called directly:

```bash
docker compose -f backend/compose.yaml --profile app up -d --build
```

| Address | What |
| --- | --- |
| `http://localhost:8080` | site, API, admin UI at `/admin/` — all through the gateway |
| `http://localhost:8080/swagger-ui.html` | the specification, both groups |
| `http://localhost:8180` | Keycloak, console `admin` / `admin-local` |
| `http://localhost:9001` | the MinIO console |
| `http://localhost:8083` | Kafka Connect |
| `http://localhost:8081` | the portal directly, bypassing the gateway |

The local stack's editor account is `editor` / `editor-local`, created by the
realm import. Details, and why the password sits in the repository, are in
[backend/keycloak/README.en.md](../backend/keycloak/README.en.md).

**Environment only, applications from the machine.** This way they are visible in
a debugger and an edit does not require rebuilding an image:

```bash
docker compose -f backend/compose.yaml up -d
```

```bash
cd backend && ./mvnw spring-boot:run
```

```bash
cd frontend && npm run dev
```

The portal comes up on `http://localhost:8081` (not 8080 — that port belongs to
the gateway). The schema is owned by Flyway alone, migrations are applied on
start. The first administrator of the local mode is created only if both
`VEDAL_ADMIN_USER` and `VEDAL_ADMIN_PASSWORD` are set, otherwise the account
simply does not exist; with `vedal.iam.mode=keycloak` accounts live in Keycloak.

The tests run against a real PostgreSQL through Testcontainers and **require a
running Docker**. H2 is not used: dialect differences should surface here, not in
production.

```bash
cd backend && ./mvnw test
```

### 5.8a A deployed environment

The `compose.prod.yaml` overlay on top of the regular file:

```bash
docker compose -f backend/compose.yaml -f backend/compose.prod.yaml \
  --profile app up -d --build
```

What it changes and why:

- **No default value for any secret.** `${VAR:?...}` fails the start naming the
  missing variable. A production instance that silently came up with the password
  "vedal" is worse than one that did not come up.
- **Only the reverse proxy is exposed.** The ports of the database, broker,
  storage, Keycloak, Connect and the applications themselves are not published:
  inside the docker network they reach each other anyway, and from outside every
  open port is a door someone has to guard.
- **TLS on Caddy.** It obtains and renews certificates itself — the only reason
  it is here rather than nginx, where the same work is done by certbot and a
  timer, that is, by two more places that break silently and surface ninety days
  later.
- **Media on a separate domain**, read-only, `sandbox`, and no execution of
  the content. Editors put files there, and sharing the site's origin and cookies
  with them serves nothing.
- **Keycloak on a persistent database** and in `start` mode rather than
  `start-dev`: the embedded H2 does not survive a container restart, and the
  employee accounts go with it.
- **Backups** — a daily `pg_dump -Fc` with weekly rotation. This is not the
  target scheme from the spec (continuous WAL via `wal-g` into another
  account's bucket) but a minimum that beats having none. Once a month it must be
  restored into a separate database and the row counts compared: a backup never
  restored is a hypothesis.

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

136 Java files in the portal and 2 in the gateway, 24 test classes (159 portal
tests, 4 gateway tests, all green; plus 56 frontend tests), 15 Flyway migrations,
18 controllers, 12 catalog items in the seed, 5 categories. The coverage gate is
70% of instructions and 45% of branches against 72% and 47% achieved.
Spring Boot 4.1.0 on Spring Framework 7, Java 25, Jackson 3,
PostgreSQL 16, Testcontainers. The gateway runs Spring Boot 4.0.7 with Spring
Cloud Gateway 5.0.2: that is the only supported pair, and the version skew is
harmless precisely because it is a separate process.

All implementation steps but the last are closed: `catalog` → `content` →
`crm` + Forms API → `notifications` → `documents` → Kafka (publishing **and**
consuming from the topics via Debezium) → `assistant`. Step 8 — the move to the
cloud — remains.

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
| `/api/admin/v1/products`, `/categories` | admin UI | the whole catalog: editing, specs, images, publishing |
| `/api/admin/v1/news` | admin UI | news: creating, editing, publishing, deleting a draft |
| `/api/admin/v1/documents` | admin UI | the card, file upload up to 20 MB, publication with the refusal explained |
| `/api/admin/v1/leads` | admin UI | leads by page, status and owner; conversion into a deal |
| `/api/admin/v1/clients` | admin UI | client base: search, card, editing, history |
| `/api/admin/v1/deals` | admin UI | deals of three pipelines: stages, attachments, quotes, history |
| `/api/admin/v1/quotes` | admin UI | quotes: lines, total, sending, the client's decision |
| `/api/admin/v1/analytics` | admin UI | the funnel by product, source, language and campaign |
| `/api/admin/v1/audit` | admin UI | the log with filters and the chain by `correlation_id` |
| `/api/admin/v1/media` | admin UI | image upload into the read-open bucket |
| `/api/admin/v1/session` | admin UI | who signed in and which roles the portal parsed |

The forty-six routes and sixty-four operations of the admin API are described by
a separate specification group —
[docs/api/vedal-admin-openapi.yaml](api/vedal-admin-openapi.yaml).

There is no public door to the CRM and there never will be: the client base,
deal amounts and quote prices belong to the closed contour. Nothing of this goes
outward, topics included: a deal event carries the identifier, the pipeline and
the stage, but not the client's name and not the amount.

A note on `assistant`: the limits live in `Guardrails` **before** the engine is
called, not in the prompt — a prompt is a request to the model, not a guarantee.
Closed materials are physically unreachable: `LlmEngine` only goes through
`CatalogQuery`, `ContentQuery` and `DocumentQuery`, and those return published
items exclusively. The assistant cannot be talked into showing a closed file
because the file is not in the context. No suitable sources means no answer —
there is a handoff to a human.

### 6.2 Frontend — the site and the admin UI

Next.js 16.3.0, React 19.2.8, App Router, TypeScript, CSS Modules, no external
dependencies besides Next and React.

Nine site routes: `/`, `/products`, `/products/[slug]`, `/production`,
`/documents`, `/news`, `/service`, `/about`, `/contacts`. Twelve product cards
(R1 and R2 share one), five categories, animations, a preloader, an animated
VEDAL mark, a map, tabs on the product page.

Twenty-one admin routes. Site content: dashboard, products with a list and an
edit form, categories, news, documents, audit log, the Keycloak callback. CRM:
leads with conversion into a deal, clients, deals across three pipelines, quotes,
analytics in four dimensions. The navigation is split into those two sections:
a flat list of eleven items reads as a heap, while the sections match what the
person is doing — an editor edits the catalog, a manager runs deals.

The card version travels back in the edit form, and it is taken from the portal's
response rather than from what was read when the card was opened: without that,
a second save in a row gets a `409` out of nowhere. The version conflict itself
is handled apart from other refusals: the editor needs "re-read the card", not
"try again" — a retry would send the same stale version and get the same refusal
in a loop.

The site and the admin UI are separated by the `(site)` and `(admin)` route
groups, each with its own root layout. A nested layout cannot remove the parent's
chrome: the header, the footer, the preloader and the floating Urania would have
arrived in the admin UI too. The site's page addresses did not change: a group
name in parentheses never reaches the URL.

### 6.3 The gap is closed

The wire between the halves exists:

- the catalog, the news and the documents are read from the Public API at build
  time and become static — property №1 is intact, a backend outage does not take
  down an already built site;
- `LeadForm` submits to the Forms API with an `Idempotency-Key` and a consent
  version, `UraniaChat` asks the assistant;
- the admin UI edits content through the Admin API under a Keycloak token.

The frontend has two API addresses, and that is not duplication: the catalog is
read at build time from inside the container (`VEDAL_API_INTERNAL_URL`), while
forms and the admin UI are called from the browser (`NEXT_PUBLIC_API_URL`). One
address for both cases is impossible: `localhost:8080` from inside a container
leads to the container itself, and `portal:8081` does not resolve in a browser.

**What is left of the old gap:** multilingual routing, SEO markup and Yandex
Metrica from section 8 — those are about content, not about the wire.

---

## 7. What is needed on the backend side

| # | What | State and pitfalls |
| --- | --- | --- |
| 1 | Merge `dev` → `main`, push every layer branch | from outside the project still looks like documents without code |
| 2 | ~~Consumers read from topics~~ | ✅ Debezium reads the outbox from the write-ahead log, consumers take events from the topics, DLQ on `<topic>.dlq` after three attempts |
| 3 | ~~Keycloak instead of local accounts~~ | ✅ the portal verifies a realm token and parses `realm_access.roles`; local accounts remain as the `vedal.iam.mode=local` fallback. **Not closed: MFA** — enabled by realm policy in a deployed environment, which does not concern the portal |
| 4 | ~~Object storage and `FileStorage`~~ | ✅ S3 through the AWS SDK: MinIO locally, Yandex Object Storage in the cloud. Two buckets, privacy anchored to the bucket. **Not closed:** which cloud exactly |
| 5 | ~~Grow `crm` to full: clients, deals, quotes, statuses, dealer and service funnels, correspondence history, attachments from approved documents, analytics by product/source/language/campaign~~ | ✅ the module is complete: `client`, `deal` with three pipelines, `quote` with lines, `interaction` (append-only), attachments from approved documents, four analytics dimensions. **Not closed:** CRM roles await the answer to question 12.3, the 1С exchange awaits 12.4 (the `inn`/`kpp`/`external_id` columns are in place already), the quote letter awaits Яндекс 360 SMTP |
| 6 | `MailSender` → Yandex 360 SMTP | letters still go to the log |
| 7 | `LlmEngine` → YandexGPT + pgvector, the pipeline text extraction → chunks with metadata → embeddings | **pitfall:** the EnterpriseDB PostgreSQL build for Windows does not ship pgvector. A `pgvector/pgvector:pg16` image is needed, and `compose.yaml` and `PostgresTestBase` must be switched **at the same time**, otherwise the tests diverge from development |
| 8 | Step 8 — the move: VM, Managed PostgreSQL, Managed Kafka, Object Storage, backups, monitoring | depends on Yandex Cloud, which does not exist yet. **Pitfall:** Managed PostgreSQL puts logical replication behind a separate flag, and without it the Debezium connector will not start |
| 9 | ~~Perimeter: `forward-headers-strategy`, body size limit~~ | ✅ on both the portal and the gateway. **Not closed:** the trusted proxy list is set at deployment |
| 10 | CI: a build with tests and an image, graceful shutdown, rollback by returning to the previous image | images are built by `compose --profile app`; there is still no deployment and no CI |
| 11 | ~~Remove the Thymeleaf admin pages~~ | ✅ gone, together with the login form and the cookie session. The portal has no browser-facing page left |
| 12 | Outbox cleanup | the table grows without bound. Deleting needs care around Debezium: `skipped.operations` already drops `d`, but the replication slot must read a row before it is removed |
| 13 | `ETag` on the public API | deliberately deferred: on twelve items the gain is zero and `Cache-Control` is already in place |
| 14 | ~~Dependency and image scanning in CI~~ | ✅ three checks that do not overlap: Dependabot on versions (PRs land in `infra`), CodeQL on the code, Trivy inside the images. Trivy's threshold is split in two: HIGH is visible in the report, CRITICAL with a released fix fails the build |
| 15 | **Restrict `/admin/**` at the proxy** | there is no rule in the `Caddyfile`; the editing door is open to the internet and held only by the token |
| 16 | **Enable MFA in the realm** | a leaked editor password is the entire client base |
| 17 | ~~Trim the application role's rights~~ | ✅ by migration `V15`, not by a runbook line: a `BEFORE TRUNCATE` trigger on the log plus revoking `UPDATE`/`DELETE`/`TRUNCATE`. The claim "a trigger does not protect against `TRUNCATE`" turned out to be wrong — see section 5.7. **Not closed:** the application connects as the schema owner, and in the stack as a superuser, for whom a revoke means nothing. A dedicated runtime role is the next step |
| 18 | **A rate limit at the proxy** | today it lives in process memory: with a second instance it becomes per-instance, and there is no global one |
| 19 | **Verify a backup restore** | the daily `pg_dump` exists and has been restored zero times. An unrestored backup is a hypothesis |
| 20 | **Secrets in Lockbox** | today they live as an `.env` file on a machine |

Items 14–20 come from reconciling the diagram with the code; the full breakdown
is in [architecture/target_architecture.en.md](architecture/target_architecture.en.md).

---

## 8. What is needed on the frontend side

| # | What | Details |
| --- | --- | --- |
| 1 | An API client plus `NEXT_PUBLIC_API_URL`, reading the catalog, news and documents through the Public API at build time | static stays static — property #1 must not break |
| 2 | `LeadForm` → `POST /api/forms/v1/leads` | `Idempotency-Key` (a uuid per form mount), the consent text version and time, a honeypot, success/error states, handling `202`. Plus attribution: the page language and `utm_campaign` are captured when the form mounts rather than when it is submitted — otherwise the tag is lost for everyone who did not fill the form on the very first page |
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

**The CRM discrepancy is resolved in favour of the brief: it is written inside
the portal.** The document hierarchy from section 2 places the owner brief above
infrastructure_architecture, and the "open question" there was written before the
brief answered it. The way back is still open: should the customer pick an
external CRM, deals travel there as a consumer of the `vedal.deals.v1` topic —
no separate port had to be introduced for that.

---

## 12. Open questions

**To the owner / Nikolay Nikolaevich:**

1. Do we build the CRM inside VEDAL Portal? — **we follow the brief: yes,
   inside.** The module is written. The answer is still needed: it closes the
   discrepancy from section 11.
2. Which data is forbidden to store in Yandex 360?
3. Who gets access to the CRM at the first stage? — **for now the same roles as
   the rest of the admin area** (`portal-admin`, `portal-editor`). Separating
   "who may see a deal" from "who may change it" is deliberately not introduced:
   until there is an answer, that is a hierarchy nobody uses.
4. Is an integration with 1C/Kontur needed right away? — **we assume "not right
   away":** a client carries `inn`, `kpp` and `external_id`, but there is no
   exchange. Adding the columns later means a migration plus a change to every
   form and every query; adding them now costs almost nothing.
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
2. Lead retention period — 3 years proposed. There is no auto-cleanup, and until
   the period is confirmed it must not be introduced: deleting by a wrong period
   is irreversible.
3. Whether `/admin` is closed at the network level or left behind a password and
   MFA. The door is single, so either option is one rule in the `Caddyfile` plus
   a realm policy. **Neither is done today:** there is no rule at the proxy and
   MFA is off in the realm.
4. Which cloud. The storage runs on S3, and moving between MinIO and Yandex
   Object Storage changes the address and the keys, not the code.
5. When MFA is switched on in the realm. This does not concern the portal: it
   verifies an issued token and does not know how many factors were presented.
6. Who runs Keycloak in a deployed environment and how employees are created in it.

---

## 13. Order of work

1. **Merge `dev` → `main`, push the layer branches.** Cheap, and it removes the
   impression of a dead repository with no code.
2. **Exercise the admin UI on live data.** It is up, covered by tests and checked
   by hand, but has not yet met a real editor.
3. **Deploy it somewhere.** The stack comes up with one command
   (`./scripts/up.sh`), there is a production profile with TLS and backups, and
   CI runs the tests and brings the stack up — but there is still no deployed
   environment. That is the next bottleneck, and it is not in the code.
4. ~~**The full CRM**: clients, deals, quotes, funnels, analytics.~~ Done. What
   remains is exercising it on live data together with the admin UI and getting
   answers to questions 12.3 and 12.4 — roles and the 1С exchange depend on them.
5. Yandex 360 SMTP, YandexGPT + pgvector, multilingual routing, the move to
   Yandex Cloud.

The full roadmap is [operations/roadmap.en.md](operations/roadmap.en.md): stage 0
(collecting materials) → 1 (public MVP) → 2 (corporate contour) → 3 (AI search) →
4 (multilingual) → 5 (VLM for manufacturing and service).

---

## 14. Where to find what

| You need | File |
| --- | --- |
| Target architecture, contours, budget | [architecture/vedal_portal_owner_brief.en.md](architecture/vedal_portal_owner_brief.en.md) |
| The target architecture diagram with a state per block | [architecture/target_architecture.en.md](architecture/target_architecture.en.md) |
| Technical decisions, accepted and rejected | [superpowers/specs/2026-08-06-vedal-portal-architecture-design.en.md](superpowers/specs/2026-08-06-vedal-portal-architecture-design.en.md) |
| What is built on the backend, how to run it, the ports | [../backend/README.en.md](../backend/README.en.md) |
| The public API contract: entry points, forms, entities, errors | [api/README.en.md](api/README.en.md), [api/vedal-openapi.yaml](api/vedal-openapi.yaml) |
| The admin API contract | [api/vedal-admin-openapi.yaml](api/vedal-admin-openapi.yaml) |
| Single entry point, routes, body limit | [../backend/api-gateway/README.en.md](../backend/api-gateway/README.en.md) |
| Sign-in, roles, the local realm, Keycloak's two addresses | [../backend/keycloak/README.en.md](../backend/keycloak/README.en.md) |
| The outbox → Kafka connector, its settings, what to check on failure | [../backend/debezium/README.en.md](../backend/debezium/README.en.md) |
| Bring everything up on a clean machine | [../scripts/up.sh](../scripts/up.sh), [../scripts/up.ps1](../scripts/up.ps1) |
| Stack settings and where they live | [../backend/.env.example](../backend/.env.example) |
| Deployed environment: secrets, TLS, backups | [../backend/compose.prod.yaml](../backend/compose.prod.yaml), [../backend/proxy/Caddyfile](../backend/proxy/Caddyfile) |
| What CI checks | [../.github/workflows/ci.yml](../.github/workflows/ci.yml) |
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
