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

## The employee portrait

The only thing the portal stores about an employee on its own. Everything else —
login, name, roles, mail — lives in Keycloak and arrives in the token; the
portrait does not.

Keycloak can hold it in a user attribute, but changing your own attribute there
requires the privilege to change users — that is, the privilege to change anyone.
The price of that privilege is named above, and paying it for a picture is not
worth it.

**Where it lives: in the database, table `staff_avatar`.** Not in object storage,
and that is a decision rather than convenience:

| Where | Why not |
| --- | --- |
| `vedal-media` | anonymously readable — that is its purpose. An employee's portrait placed there is published. On top of that the service key holds no rights on it at all ([issue #37](https://github.com/michaelwelly/MuseonUrania/issues/37)) |
| `vedal-documents` | closed and reachable, but it is the document vault: its own door that checks publication and writes an audit entry, its own constraints. A portrait is not a document |

The database fits on the very trait that usually rules it out — size: one row per
login, replaced rather than appended, holding a normalised 256×256 JPEG, that is
tens of kilobytes. Sixty employees weigh less than one datasheet. In return come
backups (the nightly `pg_dump` covers the database only, buckets are not backed
up at all), a single transaction with the audit row, and privacy by construction:
the bytes are served by a portal door behind a token, not by a bucket policy.

The full reasoning lives in migration `V35__staff_avatar.sql`.

**What the file is checked for.** JPEG or PNG up to 2 MB, source side between 64
and 4096 pixels. The format is decided by content: the extension and the
`Content-Type` header are written by whoever uploads. What is stored is not the
uploaded file but a JPEG assembled from its pixels — a tail appended after the
end of the image, EXIF with the shooting coordinates and any polyglot payload
never reach storage, because the new file simply does not have them. Dimensions
are checked from the header, before decoding: otherwise the check stands after
the thing it guards against.

**Entry points.** Editing is `POST` and `DELETE /api/admin/v1/profile/avatar`,
with no login in the path: whose portrait it is, is decided by the token, and
there is nowhere to name someone else's. Reading is
`GET /api/admin/v1/staff/{login}/avatar`, open to every portal role: the circle
with a portrait marks the author of an audit row and the owner of a deal. Every
edit lands in the audit log.

**Renaming and deleting an account.** The portrait is keyed by login, like
everything else in the portal: the owner of a lead and a deal, the person on duty
in the schedule, `actor` in the audit log. There is no foreign key and there
cannot be one — the portal has no employee table.

- the login was **renamed** — the portrait stays under the old one, the person
  sees the letter circle again and uploads it anew. Every other reference to a
  login behaves the same way, and fixing it for one column means introducing a
  second order of things next to the common one;
- the account was **deleted** — the row stays orphaned, like an audit row of
  someone who left. There is nowhere to show it: the directory no longer returns
  that login;
- the login was **handed to another person** — the only dangerous case, and the
  `subject` column stands against it: that is `sub` from the token, which never
  changes in Keycloak. A portrait whose `subject` does not match the owner's
  token is erased at their very first sign-in — the shell asks for its own
  portrait on every page.

This protection is not complete: until the new owner of the login signs in, a
colleague sees the previous face next to that login. Closing the gap entirely
would mean asking Keycloak for the `sub` of every login — a round trip to
Keycloak for every circle in the audit log.

### A realm edit does not reach a running Keycloak

The container has a named volume, and `--import-realm` does not touch a realm
that already exists. To apply changes on your own machine the volume has to go:

```bash
docker compose -f backend/compose.yaml down keycloak && docker volume rm backend_vedal-keycloak
```

And one more detail of the same kind: without `clientAuthenticatorType:
client-secret` Keycloak silently ignores the secret from the realm file — the
client is imported and has no password.
