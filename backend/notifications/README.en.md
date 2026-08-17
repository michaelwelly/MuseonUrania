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

## Build module

`portal-notifications` is a Maven module with its own `pom.xml` and its own `src/`.
It depends on: `common`, `crm`.

The dependency on `crm` is `LeadContacts`: the recipient address is fetched by
identifier so that personal data never reaches the topics.

The boundary is enforced by the build rather than by discipline: importing
from a module that is not among the dependencies fails compilation. Previously
all the code sat in one heap under `backend/src/`, and the boundaries held
only as long as someone was paying attention.
