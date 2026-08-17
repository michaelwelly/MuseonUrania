# gateway

[Русский](README.md) · **English**

The Integration Gateway — the single door through which external requests reach
the CRM. From the
[owner brief](../../docs/architecture/vedal_portal_owner_brief.en.md): "a
controlled gateway between systems", "rules, approve, audit".

What it does:

- Accepts a lead from a website form, a Yandex Form or corporate mail.
- Checks the source, the set of fields and the attachments.
- Creates a draft lead in the CRM — without automatic access to closed data.
- Writes every request to [audit](../audit/README.en.md).

What it does not do: it does not store the customer base and does not send data
outside.

The forms that arrive here are described in
[content_model.en.md](../../docs/frontend/content_model.en.md) → Lead Form Model:
quote, catalog, consultation, service, partnership.

The frontend forms are already built but have nowhere to send to —
`frontend/components/LeadForm.tsx` is waiting for this module.

## Build module

`portal-gateway` is a Maven module with its own `pom.xml` and its own `src/`.
It depends on: `common`, `crm`.

The dependency on `crm` is `LeadIntake` and nothing else: the door sees
neither the lead entity nor its repository.

The boundary is enforced by the build rather than by discipline: importing
from a module that is not among the dependencies fails compilation. Previously
all the code sat in one heap under `backend/src/`, and the boundaries held
only as long as someone was paying attention.
