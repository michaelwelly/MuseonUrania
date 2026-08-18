# VEDAL Portal: backend architecture

[Русский](2026-08-06-vedal-portal-architecture-design.md) · **English**

Date: 2026-08-06. Status: agreed in discussion, awaiting written review.

## The frame

The target picture from the
[owner brief](../../architecture/vedal_portal_owner_brief.en.md) is a proposal
that has not been accepted yet. Building all of it now means writing code against
unresolved decisions. So this spec describes an architecture that:

- covers what we are delivering now: the website, the backend behind it, the
  admin panel and the skeleton of the assistant;
- leaves prepared places for what appears if the proposal is accepted: the full
  CRM, Keycloak, the closed contour, AI search over documents.

What we do:

1. The backend for the current website — catalog, news, documents, lead intake.
2. The admin panel — employee sign-in, content management, viewing leads.
3. The LLM skeleton — the Urania contour with its limits, into which a model is
   plugged.

What we do not do before agreement: the deal and quote funnel, Keycloak,
VPN/Zero Trust, the private Document Vault with role-based access, VLM for
service and manufacturing.

## Five properties we measure stability by

The formulations are concrete so that a decision can be checked against them.

1. **A backend outage does not take the website down.** The catalog, the news and
   the documents are baked into static files at build time. A live backend is
   needed by the forms and by Urania.
2. **The schema changes only through migrations.** A manual `ALTER` in production
   is forbidden: after it a dump restores into a schema that is not in the
   history.
3. **Only published content goes outside.** This is a property of the query, not
   of the editor's discipline.
4. **A lead is never lost.** The database write and the event are committed in one
   transaction.
5. **One door for external writes.** The validation rule is written once.

## The general shape

One Spring Boot application, one database, three entrances:

| Entrance | Who calls it | What it does |
| --- | --- | --- |
| `Public API` | site build, Urania | read-only, published content only, cacheable |
| `Forms API` | website, Yandex Form, mail parsing | the single external write |
| `Admin UI` | employee | content, documents, leads; behind a session |

We do not add a fourth door: a new feature arrives into one of the three. Then the
perimeter is checked in three places rather than in thirty controllers.

### Modules

The boundaries come from [backend/README.en.md](../../../backend/README.en.md),
plus two new ones: `content` (news and press centre) and `assistant` (Urania).

| Module | Responsibility |
| --- | --- |
| `catalog` | products, categories |
| `content` | news, press centre |
| `documents` | document metadata, publication, files |
| `crm` | leads, statuses, owner |
| `assistant` | Urania: search over published content, limits |
| `notifications` | templated letters |
| `audit` | the log, append-only |
| `iam` | admin accounts, roles |
| `common` | errors, identifiers, time, outbox |

**Dependency rule:** a module never imports another module directly, only its
interface. `crm` knows `CatalogQuery`, not the internals of `catalog`. This is the
price we pay now for being able to extract a module into a separate service later
without untangling a knot.

### Ports to the outside

Four interfaces, each with a simple implementation early and a full one later.
The domains do not know what is behind a port; changing the implementation is a
matter of configuration.

| Port | Early implementation | Full implementation |
| --- | --- | --- |
| `FileStorage` | local directory | Yandex Object Storage |
| `MailSender` | writes to the log | Yandex 360 SMTP |
| `LlmEngine` | deterministic search | YandexGPT + pgvector |
| `EventPublisher` | writes to the log | Kafka |

Signed links and privacy are a property of `FileStorage`, not of the calling code.
Moving to S3 cannot accidentally expose a closed file.

## API contracts

The version is in the path. A breaking change means a new version; the old one
lives until consumers are migrated.

### Public API

```
GET /api/public/v1/categories
GET /api/public/v1/products
GET /api/public/v1/products/{slug}
GET /api/public/v1/news
GET /api/public/v1/news/{slug}
GET /api/public/v1/documents
```

Returns only records with `published = true`. Responses carry `ETag` and
`Cache-Control: public, max-age=300` so that a repeated site build does not hit
the database. Errors are `application/problem+json` (RFC 9457), one format for
every door.

### Forms API

```
POST /api/forms/v1/leads
Idempotency-Key: <uuid>
```

Body: the form type (`quote | catalog | consultation | service | partner`), the
fields from [Lead Form Model](../../frontend/content_model.en.md), and consent.
The response is `202` plus a request identifier. A repeat with the same key
returns the same response and does not create a second lead.

Protection: a rate limit by the real client address, a honeypot field, a body size
limit. There is no authorization — the door is public by design.

### Assistant API

```
POST /api/assistant/v1/ask
```

The response contains text and a list of sources. If there are no suitable
published sources, there is no answer — there is a handoff to a human with
contacts.

### Admin UI

`/admin/**`, Thymeleaf, session, Spring Security. A separate route was chosen
deliberately: it can be closed off entirely at the proxy level without touching
the application.

> **Revised on 14 August 2026.** The employee door stayed a single door but
> changed shape: instead of server-rendered pages it is JSON at
> `/api/admin/v1/**` behind a Keycloak token, with the Next.js admin UI on top.
> The Thymeleaf pages are gone, and with them the portal has no browser-facing
> page at all — hence no login form, no cookie session, no CSRF token. The "can
> be closed off entirely at the proxy" property is preserved: it is still one
> route.
>
> Current state — [docs/PROJECT.en.md](../../PROJECT.en.md), section 5.1.

## Data

### First step: the catalog

```
category        id, slug, name, position
product         id, slug, name, kind, summary, detail,
                doc_status, published, sort_order,
                image_src, image_alt, created_at, updated_at
product_category  product_id, category_id
product_spec    id, product_id, kind, position, label, value, muted
```

`doc_status` (`confirmed | pending`) and `published` are **different** flags. The
first means "the specifications are confirmed by a datasheet" and draws a badge on
the website. The second means "visible outside". Collapsing them into one removes
half of the catalog from the site.

Fields from the [Product Model](../../frontend/content_model.en.md) that nobody
can fill in right now (certification, approver, languages, `cta_type`) are not
created — they will be added by a migration once the answers arrive. An empty
column rots faster than it gets filled.

Seeding: a seed migration carries 13 items over from
`frontend/content/products.ts`.

### Shared tables

```
outbox          id, aggregate, aggregate_id, type, payload,
                created_at, published_at
audit_entry     id, at, actor, action, subject, subject_id,
                correlation_id, ip, payload
lead            id, form, name, company, phone, email, product_slug,
                message, consent_version, consent_at, source, status,
                owner, correlation_id, idempotency_key, created_at
```

`audit_entry` is insert-only: the application has no `UPDATE` and `DELETE`
permissions. A log that can be corrected retroactively is useless during an
incident investigation.

An index on `outbox (published_at, id) WHERE published_at IS NULL` — the relay
works through it and the lag is measured on it.

## Events

A transactional outbox: the entity row and the event row are committed by a single
`COMMIT`. A separate relay reads the outbox and publishes. Publishing directly
from a handler is forbidden — between the `INSERT` and the send there is a gap
that leads fall into.

| Topic | Who writes | Who reads |
| --- | --- | --- |
| `vedal.leads.v1` | `crm` | letters, audit |
| `vedal.documents.v1` | `documents` | indexing, audit |
| `vedal.notifications.v1` | `notifications` | sending |
| `vedal.audit.v1` | everyone | writing the log |

The partitioning key is the entity identifier: events of one lead do not get
reordered. Consumers are idempotent, and processed identifiers are kept in a
table. An event that is still not processed after retries goes to the DLQ and is
handled manually — otherwise one broken PDF stops the conveyor.

Kafka is not the source of truth and is not backed up: everything in the topics
originates from the outbox.

## The Urania pipeline

A document marked public in the admin panel leaves by an event: text extraction
(PDF, with OCR when needed) → chunking with product and language metadata →
embeddings → pgvector. The answer is assembled from the found chunks and must
carry links to the sources.

The limits from
[urania_assistant_spec.en.md](../../strategy/vedalina_assistant_spec.en.md) live
**in the service above the port**, not in the prompt: no diagnosis, no treatment
advice, no invented specifications, prices or deadlines, no internal documents.
The model receives only what we handed it — it cannot be talked into showing a
closed file, because the file is not in the context.

pgvector as an extension to the main database. A separate Qdrant only if the
corpus outgrows it, which will be visible in the search latency.

## Backups and recovery

A backup on the same server is not a backup. A backup that has never been
restored is a hypothesis.

| Scenario | Protection |
| --- | --- |
| The machine burned down | Continuous WAL through `wal-g` into Object Storage, a full backup once a week |
| Access to the cloud is lost | A weekly encrypted `pg_dump -Fc` into a bucket of another account |
| The backups were deleted | A separate service account with write-only permissions, bucket versioning |
| Files were lost | Object Storage versioning; recovery is verified by the pair "dump + bucket state" |

The dump encryption key lives in Lockbox and in an offline copy: if the account is
lost, Lockbox is lost with it.

A monthly check: the latest dump is restored into a separate database, the
migrations are run on it and the row counts of the key tables are compared.

Preliminary figures, **awaiting confirmation**: acceptable data loss — 5 minutes,
time to recovery — 1 hour. Practically everything valuable is concentrated in the
`lead` table; the catalog and the news are reproducible from the repository.

## Observability

- Structured logs with a `correlation_id` across all layers and events.
- Metrics through Actuator.
- **The main signal is the outbox lag.** The relay stopped, the application is
  green, forms are accepted, users see "thank you", leads pile up and go nowhere.
  Alert: there are records older than 5 minutes.
- The second signal: the last successful backup is older than a day.
- Personal data is not written to the logs — only the `correlation_id` and the
  lead identifier. Otherwise the logging system also becomes a store of personal
  data.

## Personal data

The forms collect a name, a phone number and an email. Consequences for the
schema:

- Store not a checkbox but the **version of the consent text** and the time. A
  year later there is no other way to prove what exactly the person agreed to.
- A retention period and automatic cleanup. Preliminarily 3 years, **awaiting
  confirmation**.
- Deletion upon request.
- Infrastructure in Russia — satisfied by choosing Yandex.

## The perimeter

The application sits behind a reverse proxy. Settings without which it works
incorrectly:

- `server.forward-headers-strategy=framework` and a list of trusted proxies.
  Otherwise the rate limit counts all visitors as one client and the audit log
  records the proxy address instead of the user's.
- The body size limit on the proxy is aligned with document uploads, otherwise a
  PDF fails with 413 before reaching the application.
- Timeouts: long operations live in the asynchronous pipeline, not in HTTP.

A VPN is a perimeter, not authorization. Sign-in, roles and audit in the admin
panel are needed regardless of whether it is closed off at the network level.

**Decision on `/admin`:** for now it is reachable from the internet behind a
password and a second factor; closing it at the network level is a switch at the
proxy level once a VPN exists. The code does not depend on the choice.

## Delivery and environments

A build with tests and an image, migrations applied on start, deployment with
graceful shutdown — a lead in flight during a restart is written to the end. A
rollback is a return to the previous image, not "we will fix it forward". The
website does not flicker during deployment: it is static.

The environments come from
[infrastructure_architecture.en.md](../../architecture/infrastructure_architecture.en.md):
`prod`, `staging`, `internal`, `lab`. In `lab` — non-secret data only.

Domain tests run against a real database through Testcontainers, not H2: dialect
differences surface in production, not in tests.

## Implementation order

From simple to complex. Every step leaves a working application.

1. **`catalog`** — Postgres in Docker, Flyway, the error format, tests, the public
   API, the seed from `products.ts`, CRUD in the admin panel.
2. **`content`** — news through the same mechanics. A check that the pattern is
   repeatable.
3. **`crm` + Forms API** — lead intake, idempotency, outbox, the lead list in the
   admin panel.
4. **`notifications`** — letters from the outbox, templates, delivery accounting.
5. **`documents`** — metadata, `FileStorage` on a local directory, publication,
   public links.
6. **Kafka** — the relay starts publishing, `audit` starts consuming, DLQ.
7. **`assistant`** — Urania on a deterministic search over published content, the
   limits in the service.
8. **The move** — Object Storage instead of a directory, Managed PostgreSQL,
   Managed Kafka, VM, backups, monitoring.

Steps 1 and 2 need no infrastructure. Step 8 depends on Yandex Cloud, which does
not exist yet — until then the backend lives locally and the website stays static.

Eight steps are not one implementation plan. A plan is written for step 1; each
following step gets its own once the previous one is closed.

## Considered and rejected

Recorded so that these questions do not have to be revisited.

**MongoDB for documents.** For files it loses to an object store: bytes in the
database bloat the backup, and there is no CDN, no signed links and no lifecycle
rules. For metadata the structure is rigid and tied to the catalog — the strong
side of a relational database. The main objection: a transactional outbox only
works inside one database. Putting the documents in Mongo and the outbox in
Postgres would bring back the gap between the write and the event that the outbox
was introduced to close. The parsed text for Urania, where the shape of the data
floats, is covered by a `jsonb` column.

**Redis for caching.** The public API is cached by headers, the database is not
under load.

**A separate Qdrant.** `pgvector` as an extension is enough for our corpus; the
move is justified when search latency grows, and that is visible in the metric.

**Microservices.** One application for 50 employees. The module boundaries are
already drawn so that any of them can be extracted once there is a reason.

## Decisions awaiting confirmation

1. Acceptable data loss and time to recovery: 5 minutes and 1 hour proposed.
2. Lead retention period: 3 years proposed.
3. Whether `/admin` is closed at the network level or left behind a password and
   MFA.
4. Where the object storage lives — the question is open in
   [infrastructure_architecture.en.md](../../architecture/infrastructure_architecture.en.md)
   as well.
5. When Keycloak is introduced — after the closed contour is agreed.
6. The employee count discrepancy: 50 in the brief, 60 in
   [functional_requirements.en.md](../../strategy/functional_requirements.en.md).
