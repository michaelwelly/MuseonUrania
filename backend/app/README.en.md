# app

[Русский](README.md) · **English**

The Spring Boot entry point: wiring modules into an application, environment
configuration, schema migrations, health checks.

Environments come from
[infrastructure_architecture.en.md](../../docs/architecture/infrastructure_architecture.en.md):
`prod`, `staging`, `internal`, `lab`.

No domain logic belongs here — only wiring and settings.
