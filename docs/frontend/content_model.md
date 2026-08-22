# Модель контента фронтенда

**Русский** · [English](content_model.en.md)

## Назначение

Сайт должен строиться на структурированном контенте, чтобы ответы НН можно было
вставить, не перерисовывая интерфейс целиком.

## Модель страницы

```json
{
  "route": "/products/",
  "title": "Продукция",
  "page_status": "draft",
  "public_status": "public",
  "language": "ru",
  "seo_title": "ожидает ответа НН",
  "seo_description": "ожидает ответа НН",
  "hero": {
    "headline": "ожидает ответа НН",
    "subheadline": "ожидает ответа НН",
    "primary_cta": "Запросить КП",
    "secondary_cta": "Каталог",
    "image_asset": "ожидает материалов от НН"
  },
  "approver": "ожидает ответа НН"
}
```

## Модель изделия

```json
{
  "id": "vedal-r1",
  "slug": "vedal-r1",
  "name": "VEDAL R1",
  "category": "neonatal_resuscitation",
  "product_priority": 1,
  "public_status": "ожидает ответа НН",
  "short_description": "ожидает ответа НН",
  "use_case": "ожидает ответа НН",
  "advantages": [],
  "specs_public": [],
  "certification": {
    "registration_status": "ожидает ответа НН",
    "iso": "ожидает ответа НН",
    "documents": []
  },
  "media": {
    "main_image": "ожидает материалов от НН",
    "gallery": [],
    "video": []
  },
  "documents": [],
  "cta_type": ["quote", "catalog", "consultation", "service"],
  "language_ready": ["ru"],
  "approver": "ожидает ответа НН"
}
```

## Модель документа

```json
{
  "id": "doc-product-catalog-2026",
  "title": "Каталог продукции VEDAL",
  "document_type": "catalog",
  "public_status": "ожидает ответа НН",
  "sensitivity": "public | internal | confidential",
  "language": "ru",
  "product_ids": [],
  "file_asset": "ожидает материалов от НН",
  "source_owner": "ожидает ответа НН",
  "approval_status": "draft",
  "approved_by": "ожидает ответа НН",
  "revision": "ожидает ответа НН"
}
```

## Модель формы заявки

```json
{
  "form_id": "quote_request",
  "title": "Запросить КП",
  "fields": [
    "name",
    "company",
    "phone",
    "email",
    "product_interest",
    "serial_number",
    "message",
    "consent"
  ],
  "crm_route": "ожидает решения по CRM",
  "email_fallback": "ожидает ответа НН",
  "success_message": "Спасибо. Специалист VEDAL свяжется с вами."
}
```

`serial_number` — серийный номер изделия. Показывается только в сервисной
форме: в запросе цены или каталога изделия у человека ещё нет. Необязателен —
номер знают не всегда, и обращение без него принимается как обычное.

Формат не проверяется: вид серийного номера VEDAL в согласованных материалах
не описан, а проверка по придуманной маске отклоняла бы настоящие номера.
Ограничена только длина — 100 символов.

## Модель ассистента Ведалина

```json
{
  "assistant_name": "Vedalina",
  "assistant_role": "публичный ассистент по продукции, документам и навигации",
  "assistant_avatar": "assets/vedalina/vedalina-avatar-middle-v1.png",
  "assistant_slot": "hero_and_floating_button",
  "quick_actions": [
    "Подобрать оборудование",
    "Найти документ",
    "Запросить КП",
    "Сервис"
  ],
  "allowed_sources": [
    "согласованные публичные страницы",
    "согласованные публичные PDF",
    "согласованный каталог продукции"
  ],
  "blocked_answers": [
    "медицинский диагноз",
    "рекомендации по лечению",
    "несогласованные клинические заявления",
    "выдуманные цены",
    "выдуманные сроки поставки",
    "закрытые документы"
  ],
  "handoff_forms": [
    "quote_request",
    "catalog_request",
    "consultation_request",
    "service_request"
  ]
}
```

## Модель Smart Solution

```json
{
  "integration_partner": "Smart Solution",
  "role": "технологический интеграционный слой",
  "public_visibility": "вторичен по отношению к VEDAL",
  "responsibilities": [
    "передача форм в CRM",
    "структура метаданных S3 и документов",
    "будущая интеграция AI-поиска",
    "роадмап ассистента и аналитики"
  ]
}
```

## Какие ответы нужны от НН

Критичные поля до финального дизайна:

- `product_priority`
- `public_status`
- `certification.registration_status`
- `media.main_image`
- `documents.public_status`
- `approver`
- `assistant_slot`
- `assistant_allowed_sources`
- `crm_route`
