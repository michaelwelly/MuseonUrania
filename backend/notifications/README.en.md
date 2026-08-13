# notifications

[Русский](README.md) · **English**

Outgoing mail: confirmation to the customer, notification to the responsible
manager.

A constraint from the
[owner brief](../../docs/architecture/vedal_portal_owner_brief.en.md), the
"Reply to the customer" step: only a templated letter or an approved document
goes outside. Free-form text with commercial terms is not sent through this
module.

The transport is Yandex 360 corporate mail, which we buy. What lives here is
templates, the sending queue and delivery accounting.

The confirmation text comes from
[content_model.en.md](../../docs/frontend/content_model.en.md):
"Спасибо. Специалист VEDAL свяжется с вами."
