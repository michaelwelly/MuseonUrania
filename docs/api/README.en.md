# Public API specification

[Русский](README.md) · **English**

The contract the website and external integrations use to reach the portal
backend.

| File | What for |
| --- | --- |
| `vedal-openapi.yaml` | Reading by eye, attaching to a task, reviewing in a diff |
| `vedal-openapi.json` | Importing into Postman and Insomnia, client generation, `editor.swagger.io` |

Both files are the same OpenAPI 3.1 specification: nine operations, fourteen
schemas, five sections — «Каталог», «Новости», «Документы», «Формы»,
«Ассистент».

## The code is the source of truth, not these files

The specification is assembled by springdoc from controller annotations and DTO
records. The files here are an export, taken by hand for those who would rather
not start the application.

Hence the rule: **editing them in this directory achieves nothing**. The
contract changes in `backend/src/main/java/ru/vedal/portal/`, and the export is
repeated afterwards. Field constraints (allowed form types, phone format,
minimum message length) reach the specification from Bean Validation
annotations — that is, from the very checks that run at the trust boundary.

There is no automatic reconciliation: the export can fall behind the code. What
will not fall behind is the set of entry points — `OpenApiDocsTest` checks the
documented paths against the application's actual routes, so a new door cannot
appear silently.

## Live version

While the application is running:

- Swagger UI — <http://localhost:8081/swagger-ui.html>
- JSON — <http://localhost:8081/v3/api-docs/vedal-public>
- YAML — <http://localhost:8081/v3/api-docs.yaml/vedal-public>

In the `prod`, `staging` and `internal` profiles the specification and Swagger
UI are switched off: a list of entry points is a map of the system, the same
reason only health is exposed from actuator. The integration contract is taken
from here or from dev, not from a production address.

## Refreshing the export

```bash
cd backend && ./mvnw spring-boot:run
```

```bash
curl -s http://localhost:8081/v3/api-docs/vedal-public -o docs/api/vedal-openapi.json
curl -s http://localhost:8081/v3/api-docs.yaml/vedal-public -o docs/api/vedal-openapi.yaml
```

The application needs a database — it comes up from `backend/compose.yaml`.

## What is not here

The admin area. `/admin/**` are Thymeleaf pages: they accept `form-urlencoded`
and answer with a redirect. springdoc does not document such handlers, and
passing off a browser interface as an integration API serves no purpose. Access
rules for the admin area are described in `ru.vedal.portal.iam.SecurityConfig`.

A standalone single-file copy of Swagger UI. Such a file can be assembled, but
nine tenths of it is minified swagger-ui, and keeping a megabyte and a half of
third-party code in the repository serves no purpose: the application serves
that same interface itself.
