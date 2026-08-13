# Передача фронтенда

**Русский** · [English](HANDOFF.en.md)

## С чего начать

Этот репозиторий — пакет передачи по редизайну сайта VEDAL и концепции
ассистента Урания.

Основной фронтовый пакет:

- `docs/frontend/README.md`
- `docs/frontend/claude_context_bundle.md`
- `docs/frontend/sitemap.md`
- `docs/frontend/content_model.md`
- `docs/frontend/page_briefs.md`
- `docs/frontend/implementation_checklist.md`

## Прототип и материалы

Прототип:

- `prototypes/urania-web-interface.html`

Материалы Урании:

- `assets/urania/urania-avatar-concepts-v1.png`
- `assets/urania/urania-avatar-middle-v1.png`
- `assets/urania/urania-web-integration-mockup-v1.png`

Рекомендованный аватар для MVP:

- `assets/urania/urania-avatar-middle-v1.png`

## Презентация

Последняя версия:

- `outputs/vedal_frontend_design_pipeline_v3_urania_visuals.pptx`
- `outputs/vedal_frontend_design_pipeline_v3_urania_visuals.pdf`

## Рамки первого релиза

В первую очередь:

- редизайн главной и первого экрана;
- структура каталога продукции;
- место под ассистента Урания и плавающая кнопка;
- формы запроса КП, каталога и сервиса, подготовленные к передаче в CRM;
- Smart Solution — вторичный интеграционный слой.

Отложено:

- полное развёртывание CRM;
- полная система документов на S3;
- внутренняя AI/RAG-платформа;
- пилот VLM для производства и сервиса.

## Жёсткие правила

- Не выдумывать медицинские заявления.
- Не выдумывать цены.
- Не выдумывать сертификаты и статус регистрации.
- Не показывать внутренние и закрытые документы.
- Урания не даёт диагнозов и рекомендаций по лечению.
- Там, где ответа от НН ещё нет, ставить `ожидает уточнения`.
