# admin

[Русский](README.md) · **English**

The admin API — the editing and CRM doors: `/api/admin/v1/**`.

One of the portal's three doors. It used to be server-rendered Thymeleaf pages;
now it is JSON, with the Next.js admin UI on top. The pages are gone, and with
them the portal lost its last browser-facing page — which means no login form,
no cookie session, and no CSRF token to defend.

This module is **transport only**. The rules live in the domains:
`CatalogEditor`, `ContentEditor`, `DocumentEditor`, `LeadTriage`, `ClientDesk`,
`DealDesk`, `QuoteDesk`, `HistoryDesk`, `Pipelines`. A rule written in a
controller holds exactly until a second transport appears — an import, a test,
another door.

What the module does do itself:

- works out **who** performed an action (`Actor`): with a Keycloak token
  `Principal.getName()` is `sub`, a UUID, and a log keyed by it cannot be read.
  It takes `preferred_username`, with fallbacks;
- caps page size where personal data is served: leads, clients, deals, quotes.
  `?size=1000000` must not turn a list into a dump of the whole base in one
  request.

The full contract is in
[docs/api/vedal-admin-openapi.yaml](../../docs/api/vedal-admin-openapi.yaml)
and the [Postman collection](../../docs/api/vedal.postman_collection.json).

## Build module

`portal-admin` is a Maven module with its own `pom.xml` and its own `src/`.
It depends on: `common`, `audit`, `catalog`, `content`, `crm`, `documents`.

The most connected module, and that is fine: the admin area is one door into
every domain. It sees only their `*Admin` interfaces.

The boundary is enforced by the build rather than by discipline: importing
from a module that is not among the dependencies fails compilation. Previously
all the code sat in one heap under `backend/src/`, and the boundaries held
only as long as someone was paying attention.
