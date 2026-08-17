# documents

[Русский](README.md) · **English**

Documents and media: metadata, publication status, storage in an object store.

The model is [content_model.en.md](../../docs/frontend/content_model.en.md) →
Document Model: document type, publication status, sensitivity
(public / internal / confidential), language, related products, file, source
owner, approval status, approver, revision.

Requirements from
[functional_requirements.en.md](../../docs/strategy/functional_requirements.en.md):
a public bucket or CDN only for approved materials, private buckets for anything
sensitive, role-based access, versioning, lifecycle rules.

Hard rules:

- Private buckets by default, signed links for closed files.
- No document becomes public without explicit approval.
- Service instructions, engineering and manufacturing documentation are never
  published publicly
  ([content_and_seo_plan.en.md](../../docs/strategy/content_and_seo_plan.en.md) →
  Sensitive Data Split).

Every request for a closed file is written to [audit](../audit/README.en.md).

## Build module

`portal-documents` is a Maven module with its own `pom.xml` and its own `src/`.
It depends on: `common`, `audit`.

External: the AWS SDK for S3 — the only module compiled against it.

The boundary is enforced by the build rather than by discipline: importing
from a module that is not among the dependencies fails compilation. Previously
all the code sat in one heap under `backend/src/`, and the boundaries held
only as long as someone was paying attention.
