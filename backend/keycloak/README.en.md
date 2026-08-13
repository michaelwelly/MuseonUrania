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
rule as the PostgreSQL password and the MinIO key in `compose.yaml`: these are
developer-machine values, they never leave this docker network and never reach
a deployed environment.

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
