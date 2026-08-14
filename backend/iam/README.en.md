# iam

[Русский](README.md) · **English**

Users, groups and roles, sign-in to the closed part of the portal.

From the [owner brief](../../docs/architecture/vedal_portal_owner_brief.en.md):
access through VPN/SSO/MFA, employees provisioned through groups and roles, and
on termination SSO/VPN blocked and sessions revoked.

Access groups from
[functional_requirements.en.md](../../docs/strategy/functional_requirements.en.md):
sales, service, manufacturing, engineering, management, marketing.

The identity provider itself is bought, not written. What lives here is the role
model, permission checks and the link between an account and an employee.

## Build module

`portal-iam` is a Maven module with its own `pom.xml` and its own `src/`.
It depends on: nothing.

External: Spring Security and the resource server.

The boundary is enforced by the build rather than by discipline: importing
from a module that is not among the dependencies fails compilation. Previously
all the code sat in one heap under `backend/src/`, and the boundaries held
only as long as someone was paying attention.
