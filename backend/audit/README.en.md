# audit

[Русский](README.md) · **English**

The action log: who did what and when.

From the [owner brief](../../docs/architecture/vedal_portal_owner_brief.en.md):
incidents are investigated through the logs of the website, the gateway, the CRM
and the cloud audit trail. From
[infrastructure_architecture.en.md](../../docs/architecture/infrastructure_architecture.en.md):
log access to sensitive documents and AI queries.

What is always recorded:

- intake and validation of a lead in [gateway](../gateway/README.en.md);
- changes to leads, deals and quotes in [crm](../crm/README.en.md);
- issuing links to closed files in [documents](../documents/README.en.md);
- changes to roles and access in [iam](../iam/README.en.md).

Entries are append-only. Deletion and backdated edits are not provided for —
otherwise the log is useless during an incident investigation.

## Build module

`portal-audit` is a Maven module with its own `pom.xml` and its own `src/`.
It depends on: `common`.

The boundary is enforced by the build rather than by discipline: importing
from a module that is not among the dependencies fails compilation. Previously
all the code sat in one heap under `backend/src/`, and the boundaries held
only as long as someone was paying attention.
