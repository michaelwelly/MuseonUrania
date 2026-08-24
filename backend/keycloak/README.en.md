# Keycloak: the local stack realm

[Русский](README.md) · **English**

`vedal-realm.json` is imported by the `keycloak` container from `compose.yaml`
on first start. The explanations live here rather than in the file itself:
Keycloak parses a realm strictly and fails on any field it does not know, so a
comment inside the JSON would break the import.

## What is inside

| Object | Why |
| --- | --- |
| Roles `portal-admin`, `portal-editor` | Both mean the right to edit content. Splitting "who can see" from "who can change" arrives with the CRM, where seeing a deal and changing it are different things; introducing it now would invent a hierarchy nobody uses. |
| Client `vedal-admin-ui` | Public, with PKCE. It has no secret and cannot have one: the code runs in a browser, and any "secret" there is not a secret. |
| Client `vedal-portal` | `bearerOnly`. The portal does not issue tokens — it verifies them. The client exists so its name can go into `aud`: without that, a token from any client of the same realm would fit the portal too. |
| User `editor` | The developer machine's account. |

## About the password in the repository

The user's password sits in the file in plain text deliberately, by the same
rule as the PostgreSQL password in `compose.yaml`: these are developer-machine
values, they never leave this docker network and never reach a deployed
environment.

The rule rests entirely on the value being local — and object storage keys no
longer qualify. A MinIO of our own used to stand next to the stack, and its key
was just such a local triviality. MinIO is gone from the stack, the storage is
the real one, and the same key now opens the bucket the live site reads from.
So `VEDAL_S3_ACCESS_KEY` and `VEDAL_S3_SECRET_KEY` are set in `backend/.env`,
which is not in git, and left empty in `.env.example`.

In `prod`, `staging` and `internal` Keycloak is stood up separately, accounts
are created there, and this file is not used at all. In those environments the
portal takes the realm address only from an environment variable — none of the
connection settings has a dev default there.

## Two addresses for one Keycloak

The `iss` claim is the address the browser used to obtain the token, and the
portal compares it literally. The portal cannot fetch the signing keys from that
same address inside a docker network: `localhost:8180` from inside a container
leads to the container itself.

Hence the pair of variables:

```
VEDAL_OIDC_ISSUER=http://localhost:8180/realms/vedal
VEDAL_OIDC_JWKS=http://keycloak:8080/realms/vedal/protocol/openid-connect/certs
```

The first is what to verify, the second is where to fetch keys. `KC_HOSTNAME` in
`compose.yaml` gives Keycloak the same external address so it lands in the token.

## Signing in

- Admin UI: `http://localhost:8080/admin/` (through the gateway) or `http://localhost:3000/admin/`.
- Account: `editor` / `editor-local`.
- Keycloak console: `http://localhost:8180/`, `admin` / `admin-local`.

A token for curl — via the direct password grant, enabled on the client for
local debugging:

```bash
curl -s -d grant_type=password -d client_id=vedal-admin-ui -d username=editor -d password=editor-local http://localhost:8180/realms/vedal/protocol/openid-connect/token
```

## Second factor

Not enabled: on a developer machine it gets in the way and protects nothing. The
owner brief lists MFA as mandatory, and it is switched on by realm policy in a
deployed environment — `Authentication → Required actions → Configure OTP`. This
does not concern the portal at all: it verifies an issued token and does not know
how many factors were presented at sign-in.

## Session lifetime

| Setting | Value | What it means |
| --- | --- | --- |
| `accessTokenLifespan` | 900 (15 minutes) | how long an access token lives; the admin panel renews it by itself and nobody sees it happen |
| `ssoSessionIdleTimeout` | 3600 (1 hour) | how long an admin session survives inactivity |
| `ssoSessionMaxLifespan` | 36000 (10 hours) | the ceiling regardless of activity: a working day |

An hour of idle time is a direct requirement: it used to be half an hour, and
on the stand the access token lived five minutes against fifteen locally.
Values that drift apart are what "works on my machine" is made of.

**Editing this file does not change a realm that already exists.**
`--import-realm` imports the realm on first start and leaves an existing one
alone afterwards: the `vedal-keycloak` volume outlives container recreation.
So on a running stand — and on any machine where the stack has been up before —
the new values will not appear by themselves.

Two ways to apply them:

1. **In the Keycloak console** — Realm settings → Sessions (SSO Session Idle)
   and Realm settings → Tokens (Access Token Lifespan). Thirty seconds,
   no restart, nothing is lost. This is the way to do it.
2. Recreate the realm by importing with overwrite. Do not do this without a
   reason: overwriting deletes the whole realm and with it every account
   created in the console — that is, every member of staff.

The file stays the source of truth for a clean install: a stack brought up
from scratch gets these values straight away.

## Redirect addresses

Keycloak checks `redirect_uri` against the list on the `vedal-admin-ui` client,
and it compares strings, not machines. `localhost` and `127.0.0.1` are
**different addresses** even though they are the same computer. An address
missing from the list produces "We are sorry… Invalid parameter: redirect_uri"
before the sign-in form is ever shown.

| Realm | Allowed |
| --- | --- |
| local | `http://localhost:8080/*`, `http://127.0.0.1:8080/*`, and the same on `:3000` for `next dev` |
| stand | the same plus `http://51.250.31.97:18080/*` |

A new environment means a new entry in `redirectUris` and in `webOrigins`.
A missing one surfaces only when somebody tries to sign in, and it looks like
Keycloak is broken when it is in fact client configuration.

To check without opening a browser:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  'http://localhost:8180/realms/vedal/protocol/openid-connect/auth?client_id=vedal-admin-ui&response_type=code&scope=openid&state=x&code_challenge=abc&code_challenge_method=S256&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fadmin%2Fcallback%2F'
```

`302` means the address is accepted, `400` means it is not on the list.
