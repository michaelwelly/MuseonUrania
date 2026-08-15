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

## The staff directory

The owner of a lead, a client and a deal is picked from a list rather than typed
by hand. Before the directory it was a free-text field, and a typo in a login was
indistinguishable from a correct one: the record ended up on a person who does
not exist and turned up in no filter by owner. No refusal, data present, data
wrong.

`StaffDirectory` is a port with two implementations, selected by the
`vedal.iam.mode` property — the same one that selects how people sign in. Two
separate switches would drift apart one day, and the portal would admit people
through Keycloak while offering owners from the fallback table.

| Mode | Where the list comes from |
| --- | --- |
| `keycloak` | realm users through the admin API |
| `local` | the `admin_user` table |

**Read only.** Creating a person, granting a role and disabling them on departure
is the Keycloak console's job: the identity provider is bought, not written, and
a second door to accounts would mean two places where they are created — and a
divergence at the first departure.

### The service account

Inside Keycloak the portal acts as the `vedal-portal-svc` client through the
`client_credentials` flow. That client is deliberately separate from
`vedal-portal`: the latter is `bearer-only` — it only validates tokens and cannot
obtain them at all, and `client_credentials` against it answers
`unauthorized_client`. That is not an obstacle but a separation of roles: the one
validating tokens and the one fetching the list are different things.

It holds exactly one privilege — `view-users`. Verified against a clean realm
import: reading users `200`, an attempt to create a user `403`, the client list
comes back empty, so other clients' secrets are not visible through this account.
With `manage-users` a leaked secret would mean not "they read the staff list" but
"they created themselves an administrator account".

### What does not break

- **No secret set** — the directory falls back to `admin_user` and the portal
  starts. Failing here is not allowed: a single missing optional variable would
  take down the portal together with the site and the forms.
- **Keycloak unreachable** — the previous list is served instead of an empty one.
  An empty directory in a form reads as "there are no employees" and blocks work;
  one that is two minutes stale does not.
- **A login absent from the directory** — someone who left before the directory
  existed, or the very typo it was built for. It stays in the form as its own
  option: substituting an empty value would erase the owner the moment the card
  is opened, without asking.
- **A disabled employee** stays in the list and is marked: old deals hang on
  them, and removing them would show a deal without an owner.

### A realm edit does not reach a running Keycloak

The container has a named volume, and `--import-realm` does not touch a realm
that already exists. To apply changes on your own machine the volume has to go:

```bash
docker compose -f backend/compose.yaml down keycloak && docker volume rm backend_vedal-keycloak
```

And one more detail of the same kind: without `clientAuthenticatorType:
client-secret` Keycloak silently ignores the secret from the realm file — the
client is imported and has no password.
