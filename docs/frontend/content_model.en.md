# Frontend Content Model

[Русский](content_model.md) · **English**

## Purpose

The website should be driven by structured content so that NN answers can be inserted without redesigning the whole interface.

## Page Model

```json
{
  "route": "/products/",
  "title": "Продукция",
  "page_status": "draft",
  "public_status": "public",
  "language": "ru",
  "seo_title": "awaiting NN answer",
  "seo_description": "awaiting NN answer",
  "hero": {
    "headline": "awaiting NN answer",
    "subheadline": "awaiting NN answer",
    "primary_cta": "Запросить КП",
    "secondary_cta": "Каталог",
    "image_asset": "awaiting NN asset"
  },
  "approver": "awaiting NN answer"
}
```

## Product Model

```json
{
  "id": "vedal-r1",
  "slug": "vedal-r1",
  "name": "VEDAL R1",
  "category": "neonatal_resuscitation",
  "product_priority": 1,
  "public_status": "awaiting NN answer",
  "short_description": "awaiting NN answer",
  "use_case": "awaiting NN answer",
  "advantages": [],
  "specs_public": [],
  "certification": {
    "registration_status": "awaiting NN answer",
    "iso": "awaiting NN answer",
    "documents": []
  },
  "media": {
    "main_image": "awaiting NN asset",
    "gallery": [],
    "video": []
  },
  "documents": [],
  "cta_type": ["quote", "catalog", "consultation", "service"],
  "language_ready": ["ru"],
  "approver": "awaiting NN answer"
}
```

## Document Model

```json
{
  "id": "doc-product-catalog-2026",
  "title": "Каталог продукции VEDAL",
  "document_type": "catalog",
  "public_status": "awaiting NN answer",
  "sensitivity": "public | internal | confidential",
  "language": "ru",
  "product_ids": [],
  "file_asset": "awaiting NN asset",
  "source_owner": "awaiting NN answer",
  "approval_status": "draft",
  "approved_by": "awaiting NN answer",
  "revision": "awaiting NN answer"
}
```

## Lead Form Model

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
    "message",
    "consent"
  ],
  "crm_route": "awaiting CRM decision",
  "email_fallback": "awaiting NN answer",
  "success_message": "Спасибо. Специалист VEDAL свяжется с вами."
}
```

## Urania Assistant Model

```json
{
  "assistant_name": "Urania",
  "assistant_role": "public product/document/navigation assistant",
  "assistant_avatar": "assets/urania/urania-avatar-middle-v1.png",
  "assistant_slot": "hero_and_floating_button",
  "quick_actions": [
    "Подобрать оборудование",
    "Найти документ",
    "Запросить КП",
    "Сервис"
  ],
  "allowed_sources": [
    "approved public pages",
    "approved public PDFs",
    "approved product catalog"
  ],
  "blocked_answers": [
    "medical diagnosis",
    "treatment advice",
    "unapproved clinical claims",
    "invented prices",
    "invented delivery times",
    "private documents"
  ],
  "handoff_forms": [
    "quote_request",
    "catalog_request",
    "consultation_request",
    "service_request"
  ]
}
```

## Smart Solution Model

```json
{
  "integration_partner": "Smart Solution",
  "role": "technology integration layer",
  "public_visibility": "secondary to VEDAL",
  "responsibilities": [
    "forms to CRM handoff",
    "S3/document metadata structure",
    "future AI search integration",
    "assistant and analytics roadmap"
  ]
}
```

## Required NN Answers

Critical fields before final design:

- `product_priority`
- `public_status`
- `certification.registration_status`
- `media.main_image`
- `documents.public_status`
- `approver`
- `assistant_slot`
- `assistant_allowed_sources`
- `crm_route`
