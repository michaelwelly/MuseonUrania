# API specification

[Русский](README.md) · **English**

The contract the site, the admin UI and external integrations use to talk to the
portal's server side.

| File | What for |
| --- | --- |
| `vedal-openapi.yaml` | Public API. Read it, attach it to a task, review it in a diff |
| `vedal-openapi.json` | The same, for Postman, Insomnia, client generation, `editor.swagger.io` |
| `vedal-admin-openapi.yaml` | Admin API: the contract of the admin UI |
| `vedal-admin-openapi.json` | The same in JSON |

## Two groups, and not for tidiness

**`vedal-public`** — the `/api/public`, `/api/forms`, `/api/assistant` doors.
What outsiders integrate against; read by people who have no portal account and
never will. Nine operations, five sections.

**`vedal-admin`** — `/api/admin/v1/**`. The editing doors: products, categories,
news, documents with file upload, leads, audit log, images. Twenty-five
operations.

The split exists so the list of editing doors does not end up in the file handed
to an external integrator. Mechanically it is `pathsToExclude` in `OpenApiConfig`
rather than "we just did not list them here": `/api/**` covers the admin doors
too, and without the explicit exclusion they would have joined the public group
silently.

No fourth door appeared, either. There are still three; the employee door
changed shape — JSON instead of server-rendered pages.

## The source of truth is the code, not these files

springdoc assembles the specification from controller annotations and DTO
records. The files here are an export taken by hand for people who would rather
not start the application.

Hence the rule: **editing them in this directory is pointless**. The contract
changes in `backend/src/main/java/ru/vedal/portal/`, after which the export is
repeated. Field constraints (allowed form types, phone format, minimum message
length) reach the specification from Bean Validation annotations — the same
checks that run on the trust boundary.

There is no automatic reconciliation: the export can fall behind the code. What
will not fall behind is the set of doors: `OpenApiDocsTest` compares the
documented paths against the application's real routes **in both groups**, so a
new door cannot appear silently.

## How the admin UI identifies itself

Security scheme `keycloak`: a realm access token in the `Authorization` header.
The portal's roles are `portal-admin` and `portal-editor` in
`realm_access.roles`; a token without them passes signature verification and gets
`403`. These are different states and the interface must tell them apart — "not
signed in" and "the portal rejected the token" look the same only from outside.

The fallback mode `vedal.iam.mode=local` is HTTP Basic over portal accounts. It
is deliberately absent from the specification: that is a development mode, not a
contract.

## The live version

While the application is up:

- Swagger UI — <http://localhost:8081/swagger-ui.html> (group switcher at the top)
- JSON — <http://localhost:8081/v3/api-docs/vedal-public>, <http://localhost:8081/v3/api-docs/vedal-admin>
- YAML — <http://localhost:8081/v3/api-docs.yaml/vedal-public>, <http://localhost:8081/v3/api-docs.yaml/vedal-admin>

Through the gateway the same addresses live on `http://localhost:8080`.

In the `prod`, `staging` and `internal` profiles the specification and Swagger UI
are switched off: the list of doors is a map of the system, for the same reason
actuator exposes only health. The integration contract is taken from here or from
dev, not from a production address.

## How to refresh the export

```bash
docker compose -f backend/compose.yaml --profile app up -d --build
```

```bash
curl -s http://localhost:8081/v3/api-docs/vedal-public -o docs/api/vedal-openapi.json
curl -s http://localhost:8081/v3/api-docs.yaml/vedal-public -o docs/api/vedal-openapi.yaml
curl -s http://localhost:8081/v3/api-docs/vedal-admin -o docs/api/vedal-admin-openapi.json
curl -s http://localhost:8081/v3/api-docs.yaml/vedal-admin -o docs/api/vedal-admin-openapi.yaml
```

Without Docker the application starts locally — `cd backend && ./mvnw spring-boot:run`;
the database still comes from `compose.yaml`.

## What is not here

Browser-facing pages. The portal has none left: the server-rendered Thymeleaf
admin is gone, and with it the login form and the cookie session. The only
interface the portal renders itself is Swagger UI, and that is about the
contract, not the data.

A standalone copy of Swagger UI as a single HTML file. Such a file can be built,
but nine tenths of it is minified swagger-ui, and keeping a megabyte and a half
of someone else's code in the repository serves nothing: the application serves
that interface itself.
