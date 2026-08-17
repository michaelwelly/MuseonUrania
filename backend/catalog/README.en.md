# catalog

[Русский](README.md) · **English**

Products and categories. The public API the website reads the catalog from.

The model is [content_model.en.md](../../docs/frontend/content_model.en.md) →
Product Model: identifier, slug, name, category, priority, publication status,
purpose, advantages, public specifications, registration status, media,
documents, CTA types, language readiness, approver.

Key rule: only items with a confirmed publication status go out. Specifications
are published exactly as approved — see [HANDOFF.en.md](../../HANDOFF.en.md).

For now the same data is hardcoded in the frontend
(`frontend/content/products.ts`). This module replaces it.

## Build module

`portal-catalog` is a Maven module with its own `pom.xml` and its own `src/`.
It depends on: `common`, `audit`.

The boundary is enforced by the build rather than by discipline: importing
from a module that is not among the dependencies fails compilation. Previously
all the code sat in one heap under `backend/src/`, and the boundaries held
only as long as someone was paying attention.
