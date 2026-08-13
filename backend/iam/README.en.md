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
