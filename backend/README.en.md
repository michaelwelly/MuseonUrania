# Backend

[Русский](README.md) · **English**

The server side of VEDAL Portal. Java + Spring.

The module list is derived from the
[owner brief](../docs/architecture/vedal_portal_owner_brief.en.md): website, CRM
and closed contour are one platform. Standard services (mail, cloud, database)
are bought, unique logic we write ourselves.

## What the first release contains

The brief defines the first release as: the public website and catalog; the
backend API, forms and authorization; leads, customers, deals, quotes and
documents; roles, audit, backups and a basic gateway. Plus two modules from the
[architecture spec](../docs/superpowers/specs/2026-08-06-vedal-portal-architecture-design.en.md)
that were not in the original list — `content` and `assistant`. Eleven in total:

| Module | Purpose |
| --- | --- |
| [app](app/README.en.md) | Spring Boot assembly, configuration, entry point |
| [common](common/README.en.md) | shared types, errors, validation, outbox, rate limits |
| [iam](iam/README.en.md) | users, roles, access |
| [catalog](catalog/README.en.md) | products and categories, public API for the website |
| [content](content/README.en.md) | news and press centre |
| [documents](documents/README.en.md) | documents, publication statuses, object storage |
| [gateway](gateway/README.en.md) | lead intake from the website: validation, approve, handover to CRM |
| [crm](crm/README.en.md) | leads, clients, deals, quotes, correspondence history, funnel analytics |
| [notifications](notifications/README.en.md) | customer letters and manager notifications |
| [assistant](assistant/README.en.md) | Urania: answers from published content, hard limits |
| [audit](audit/README.en.md) | log of actions and document access |

Each is a **Maven module** with its own `pom.xml`, its own `src/` and its own
README: `backend/crm/`, `backend/catalog/` and so on. Everything is built by a
single reactor from `backend/pom.xml`.

A module boundary is enforced by the build rather than by discipline. Previously
all the code sat in one heap under `backend/src/`, the folders next to it held a
README each, and nothing stopped `crm` from reaching into the guts of `catalog`
— it could only be caught at review. Now such an import fails compilation.

The dependencies between modules form a graph without a single cycle, and that
same graph is written down in `pom.xml`:

```
common          ← фундамент, не зависит ни от кого
iam             ← вход, не зависит ни от кого
audit           ← common
catalog         ← common, audit
content         ← common, audit
documents       ← common, audit
crm             ← common, audit, documents
gateway         ← common, crm
notifications   ← common, crm
assistant       ← common, audit, catalog, content, documents
admin           ← common, audit, catalog, content, crm, documents
app             ← собирает всё в одно приложение
```

A module sees only its neighbour's interface — `LeadIntake`, `CatalogQuery`,
`DocumentQuery`, `*Admin`. That is the same rule the spec already stated, except
it is now checked: `gateway` declares a dependency on `crm` and still cannot
reach `LeadRepository`, because a module's public contract is what it shows to
its neighbours.

**The only module that turns into an application is `app`.** It declares the
rest and holds the entry point, the configuration and the schema. There is still
one container: "like microservices, but like a monolith" — the boundary lives in
the build, the single process lives at runtime. The transactional outbox is
untouched by this: the entity row and the event row commit in one `COMMIT`,
because the database and the transaction are shared.

[api-gateway](api-gateway/README.en.md) lives outside the reactor — that one is
a genuine second service with its own container. It pins its own pair of Spring
Boot and Spring Cloud Gateway versions, the only supported one, and a shared
parent pom would collide with it.

## The path of a lead

It also defines the module boundaries. From the brief:

```
Lead (website, form, mail)
  → gateway        checks the source, the fields and the attachments
  → crm            creates a draft lead without access to closed data
  → crm            deal, quote, documents, statuses inside the portal
  → notifications  only a templated letter goes outside
```

Every step writes to `audit`.

## What is deferred

There are no folders for these yet:

- **knowledge** — internal AI search over documentation, stage 3 in the
  [roadmap](../docs/operations/roadmap.en.md);
- **vlm** — visual models for service and manufacturing, a separate pilot.

Deferred inside existing modules as well:

- **Moving to Yandex infrastructure.** Step 8. It depends on Yandex Cloud, which
  does not exist yet: Managed PostgreSQL, Managed Kafka, backups, monitoring.
  Pitfall: Managed PostgreSQL puts logical replication behind a separate flag,
  and without it the Debezium connector will not start.
- **`ETag` on the public API.** The spec moves it to the next stage: on twelve
  items the gain is zero, and `Cache-Control` is already in place.
- **The second factor.** Enabled by realm policy in a deployed environment. This
  does not concern the portal: it verifies an issued token and does not know how
  many factors were presented at sign-in.
- **Outbox cleanup.** The table grows without bound.

## Infrastructure: what is left and what it depends on

| What | State | What it depends on |
| --- | --- | --- |
| Kafka: publishing | ✅ ready. `vedal.events.publisher=kafka` — the relay publishes itself, `debezium` — a connector reads the log. The application creates the topics | — |
| Kafka: consumers | ✅ read from the topics in `debezium` mode, repeats cut off by `(consumer, event)`, unprocessed messages go to `<topic>.dlq` | — |
| Object Storage | ✅ S3 through the AWS SDK: MinIO locally, two areas — closed documents and open media | Which cloud it will be is an open question in [infrastructure_architecture.en.md](../docs/architecture/infrastructure_architecture.en.md) |
| Identity provider | ✅ Keycloak: the portal verifies the token and parses `realm_access.roles`. Local accounts are the `vedal.iam.mode=local` fallback | Who runs Keycloak in a deployed environment |
| Single entry point | ✅ [api-gateway](api-gateway/README.en.md) on Spring Cloud Gateway | — |
| pgvector | not used | **The EnterpriseDB PostgreSQL build for Windows does not ship the extension** — `pg_available_extensions` does not know it. A `pgvector/pgvector:pg16` image will be needed, and `compose.yaml` and `PostgresTestBase` must be switched at the same time, otherwise the tests diverge from development |
| Managed PostgreSQL, VM, backups, monitoring | none | Yandex Cloud |
| Backups: `wal-g`, weekly `pg_dump`, monthly restore check | none | Cloud and service accounts. The spec section "Backups and recovery" describes the whole target scheme |

**Separate databases are not part of the architecture.** One database follows
from the transactional outbox: the entity row and the event row must be committed
by a single `COMMIT`. The spec section "Considered and rejected" states this
plainly using MongoDB as the example. Separate databases exist here in one sense
only — one per environment.

### A discrepancy that must be resolved

The spec names **Kafka** as the broker, while
[infrastructure_architecture.en.md](../docs/architecture/infrastructure_architecture.en.md)
lists **Redis/RabbitMQ for indexing jobs** among the components. The documents
contradict each other and the decision is not recorded. Until it is,
`EventPublisher` stays a port with a logging implementation: changing the broker
will not touch a single domain.

## What is not stored and not exposed

From the brief, section "Not exposed outside": the customer base, commercial
terms, contracts, invoices, margins, tokens, personal data. The public website
API returns only the catalog and approved documents.

## Infrastructure

Bought, not written: Yandex 360 (mail, calendar), Yandex Cloud (VM, backups,
logs, monitoring), Managed PostgreSQL, Lockbox, WAF as they become relevant.

## How to run it

JDK 25 and Docker are needed. Maven does not have to be installed — the wrapper
is in the repository.

**The whole stack at once**, including the portal, the gateway and the site. This
builds what will go to the server, and everything ends up behind the single entry
point `http://localhost:8080`:

```
docker compose -f backend/compose.yaml --profile app up -d --build
```

What follows is the mode where the applications run from the machine and are
visible in a debugger.

**Database and environment.** Either in containers:

```
docker compose -f backend/compose.yaml up -d
```

or a native PostgreSQL 16 installation on port 5434 with the `vedal` role and
database. The address, user and password are overridden by `VEDAL_DB_URL`,
`VEDAL_DB_USER`, `VEDAL_DB_PASSWORD`; the defaults match `compose.yaml`. The
schema is owned by Flyway alone, migrations are applied on start.

**Application.**

```
cd backend
./mvnw spring-boot:run
```

The environments from the spec — `prod`, `staging`, `internal`, `lab` — live in
`application-<profile>.properties`. In them the connection is configured **only**
through environment variables, with no development defaults: a production
instance that silently came up on the development database is worse than one that
did not come up at all. The check runs before the datasource is created and names
the missing variables one by one:

```
Профиль 'prod' требует переменные окружения, они не заданы:
VEDAL_DB_URL, VEDAL_DB_USER, VEDAL_DB_PASSWORD, VEDAL_PORTAL_URL, VEDAL_STORAGE_ROOT
```

In deployed profiles the logs are structured (ECS JSON to stdout) and collected
by Yandex Cloud Logging. In the default profile the logs stay human-readable.

The first administrator is created only if both variables are set — otherwise the
account simply does not exist:

```
VEDAL_ADMIN_USER=editor VEDAL_ADMIN_PASSWORD=<password> ./mvnw spring-boot:run
```

The application comes up on `http://localhost:8081`. Not 8080, because that port
is taken by someone else's container on the development machine.

## What already works

The three doors from the spec: public reads, the single external write, the admin
panel.

| Route | Who calls it | What it does |
| --- | --- | --- |
| `GET /actuator/health` | monitoring | liveness; the other endpoints are closed |
| `GET /api/public/v1/categories` | site build | catalog categories |
| `GET /api/public/v1/products` | site build | published items only, `Cache-Control: max-age=300` |
| `GET /api/public/v1/products/{slug}` | site build | product page; unpublished returns 404 |
| `GET /api/public/v1/news` | site build | the feed; empty is `[]`, not an error |
| `GET /api/public/v1/news/{slug}` | site build | a publication; unpublished returns 404 |
| `GET /api/public/v1/documents` | site build | listing with access status; the file link only for published ones |
| `GET /api/public/v1/documents/{slug}/file` | visitor | the file; closed returns 404 and the request is logged |
| `POST /api/forms/v1/leads` | website forms | lead intake, `Idempotency-Key` header, `202` response; the optional `language` and `campaign` carry attribution for analytics |
| `POST /api/assistant/v1/ask` | Urania | an answer from published content with links; no sources means handoff to a human |
| `/api/admin/v1/**` | admin UI | forty-six routes, sixty-four operations: products, categories, news, documents, leads, clients, deals, quotes, correspondence history, funnel analytics, audit log, images, session |

There is no public door to the CRM: the client base, deal amounts and quote
prices belong to the closed contour.

Errors from every door are `application/problem+json` (RFC 9457). The forms and
the assistant have their own per-client rate limits. The admin API contract is
[docs/api/vedal-admin-openapi.yaml](../docs/api/vedal-admin-openapi.yaml).

Publication rules live in the domains (`CatalogEditor`, `ContentEditor`,
`DocumentEditor`, `LeadTriage`) rather than in the controllers: there are two
doors, and a rule written in a controller is honoured by only one of them. The
CRM works the same way: `ClientDesk`, `DealDesk`, `QuoteDesk`, `HistoryDesk` and
`Pipelines` hold the rules for pipelines, versions and quotes, while
`AdminClientsApi`, `AdminDealsApi`, `AdminQuotesApi` and `AdminCrmAnalyticsApi`
are transport only.

## What is enforced by database constraints rather than code

Rules that cannot be bypassed by editing a controller or by an editor's mistake:

- `document_public_only` — an internal or confidential document cannot become
  publicly downloadable;
- `document_published_has_file` — publishing without an uploaded file is
  forbidden;
- `document_published_is_listed` — a published document must appear in the
  listing;
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
- the `audit_entry_append_only` trigger — the log cannot be edited retroactively.

One constraint is deferred — `quote_item_position_unique`. Quote lines are
replaced wholesale, and in a single flush Hibernate inserts the new row before
deleting the old one; checking at `COMMIT` keeps the rule strict and removes the
dependency on statement order inside the transaction.

The trigger does not protect against `TRUNCATE`: statement triggers do not fire
for it. The real protection is revoking `UPDATE`/`DELETE`/`TRUNCATE` from the
application role, which is an administrator step during environment setup.

## Ports to the outside

The implementation changes through configuration; the domains never look behind a
port.

| Port | Now | Later |
| --- | --- | --- |
| `EventPublisher` | `log`, `kafka` or `debezium` via `vedal.events.publisher` | Managed Kafka |
| `MailSender` | writes to the log | Yandex 360 SMTP |
| `FileStorage` | `local` or `s3` via `vedal.storage.kind`; MinIO in the stack, 20 MB limit | Yandex Object Storage |
| `LlmEngine` | deterministic word search | YandexGPT + pgvector |

All three pick their implementation by a property, not by the classpath and not
by "whichever bean was found": silently switching the storage or the broker one
day means a local directory instead of S3 in production.

The catalog is filled by the `V2__catalog_seed.sql` migration, which is
**generated** rather than written by hand:

```
node backend/tools/seed-catalog.mjs > backend/src/main/resources/db/migration/V2__catalog_seed.sql
```

The source is `frontend/content/products.ts`. Editing `V2` by hand is pointless:
regenerate and commit it again.

## Tests

```
cd backend
./mvnw test
```

The tests run against a real PostgreSQL through Testcontainers, so they **require
a running Docker**. H2 is not used: dialect differences should surface here, not
in production.

The container comes from `PostgresTestBase`, and **every** test class without
exception must extend it. A test that does not raises its context on
`spring.datasource.url`, that is, on the development database of whichever
machine ran it: the run silently applies migrations to a live database, editing
an unreleased migration breaks the build with a checksum mismatch, and on a
machine without a local PostgreSQL the test fails to connect while Docker is
running and its neighbours are green.

The coverage check is a separate phase, `./mvnw verify`: the threshold lives in
`pom.xml` and works as a ratchet.

## Decisions taken

| Question | Decision | Why |
| --- | --- | --- |
| Build | Maven + wrapper | A boring standard; the wrapper removes Maven installation from the machine |
| Java | 25 | JDK 25 is installed on the system and Spring Boot 4.1 supports it |
| Number of services | One application | 50 employees; modules are `ru.vedal.portal.*` package boundaries, not separate deployments |
| Code layout | Maven reactor: `backend/<module>/src/main/java/ru/vedal/portal/<module>/` | A module folder holds its code, its pom and its README. The boundary is checked by the build, not at review |
| Number of deployments | One, assembled by `app` | Modules are a build boundary, not separate processes. Splitting them into services would cost the single `COMMIT` over entity and event — that is, lost leads |

Spring Boot 4.1.0 on Spring Framework 7. Enabled: webmvc, validation, actuator,
data-jpa, flyway, security, thymeleaf; Jackson 3.

Three Boot 4 traps already stepped on here:

- **Flyway is wired through `spring-boot-starter-flyway`,** not through
  `flyway-core` alone. In Boot 4 the autoconfigurations are split across modules:
  with only `flyway-core` the migrations are **silently** not applied, with no
  error in the log.
- **`@AutoConfigureMockMvc`** lives in
  `org.springframework.boot.webmvc.test.autoconfigure`, not in
  `org.springframework.boot.test.autoconfigure.web.servlet`.
- **Jackson 3** — the package is `tools.jackson.databind`, not
  `com.fasterxml.jackson`.

## Still undecided

- **Which cloud** hosts the Document Vault — the question is open in
  [infrastructure_architecture.en.md](../docs/architecture/infrastructure_architecture.en.md)
  as well. On the owner's diagram it is "Private Object Storage" inside the
  closed contour. The storage already speaks S3, so the move changes the address
  and the keys, not the code.
- **Who runs Keycloak** in a deployed environment and how employees are created
  in it.
- **The lead retention period.** Three years proposed, no auto-cleanup. Until the
  period is confirmed it must not be introduced: deleting by a wrong period is
  irreversible.

Work happens in the `back` branch.
