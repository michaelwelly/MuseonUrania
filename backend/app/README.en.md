# app

[Русский](README.md) · **English**

The Spring Boot entry point: wiring modules into an application, environment
configuration, schema migrations, health checks.

Environments come from
[infrastructure_architecture.en.md](../../docs/architecture/infrastructure_architecture.en.md):
`prod`, `staging`, `internal`, `lab`.

No domain logic belongs here — only wiring and settings.

## Build module

`portal-app` is the only module that turns into an application. It declares all
the others, and its `pom.xml` reads as the portal's bill of materials.

What lives here specifically, and why:

- **the entry point and environment configuration** — wiring, not logic;
- **the Flyway migrations.** They cannot be split across domains: there is one
  database (a consequence of the transactional outbox), one migration history,
  and the order between domains matters — `V14` alters `lead` and references
  `product` and `document`. Splitting them per module would introduce a race
  over version numbers between branches;
- **the tests that boot the application.** They need an assembled context with
  every module at once. Pure rule tests stayed in their own modules:
  `Pipelines` in `crm`, `Guardrails` in `assistant`, `LocalFileStorage` in
  `documents`;
- **the aggregate coverage report.** The classes live in twelve modules while
  the tests that exercise them live here; measuring per module would yield
  eleven zeros and one hundred.

The assembled jar is `app/target/portal.jar` — without a version, so that a
version bump does not require editing the `Dockerfile`.
