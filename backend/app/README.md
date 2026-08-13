# app

**Русский** · [English](README.en.md)

Точка входа Spring Boot: сборка модулей в приложение, конфигурация окружений,
миграции схемы, health-проверки.

Окружения из [infrastructure_architecture.md](../../docs/architecture/infrastructure_architecture.md):
`prod`, `staging`, `internal`, `lab`.

Здесь не должно быть доменной логики — только связывание модулей и настройки.
