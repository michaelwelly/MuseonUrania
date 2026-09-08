# VEDAL stand-prod: the perimeter and its entry points

[Русский](stand_prod_perimeter.md) · **English**

Recorded on 2026-08-27.

The stand lives on the shared VM `smart_soultion_mvp` with the public IP
`51.250.31.97`. C3AG/Astor stay on the same machine, so VEDAL is kept on
separate ports for now, without seizing `80` and `443`.

## What is exposed for VEDAL today

| Purpose | Address | Who needs it | Note |
| --- | --- | --- | --- |
| Public site and API | `http://51.250.31.97:18080` | visitors, the customer, the team | The stand's main entry point: pages, forms, Vedalina and Swagger all go through it. |
| Keycloak for staff sign-in | `http://51.250.31.97:18180` | staff and the team | Open temporarily, until the domain and HTTPS arrive. The browser needs it: without a public issuer the admin area cannot complete the login. |
| SSH | `51.250.31.97:2222` | Michael, Egor, autodeploy/operators | Keep it to exact IPs or behind a VPN. The current operator source IP is `31.184.215.189/32`. |

## How staff sign in

On the current stand-prod, staff open `http://51.250.31.97:18080/admin/` and
press sign-in with a work account. The browser goes to Keycloak at
`http://51.250.31.97:18180` and, after a successful login, comes back
to `/admin/`.

This scheme is only meant to last until the domain is connected. For real
operation with personal data, staff sign-in must run over HTTPS:

- `https://vedal-med.ru/admin/` — the admin interface;
- `https://auth.vedal-med.ru` or `https://vedal-med.ru/auth` — Keycloak;
- `18180` gets closed from outside once the reverse proxy and certificates are in place.

Passwords, tokens, client secrets, S3 keys and staff accounts are not passed
around in work chats. Once the domain is moved and real access is granted,
the temporary passwords must be replaced.

## What Vedalina uses

| Flow | Needs an inbound port? | Detail |
| --- | --- | --- |
| Site widget → API | Yes, over `18080` | `POST /api/assistant/v1/chat` and `POST /api/assistant/v1/ask`. |
| Backend → YandexGPT | No inbound port | Outbound HTTPS from the VM to `llm.api.cloud.yandex.net`. |
| Backend → PostgreSQL/Kafka | No | Inside the docker network. |
| Public media | Not a VM port | `https://storage.yandexcloud.net/vedal-media/...`. The bucket is meant for open photos and media. |
| Documents | Through the portal's API/indexing | At this stage there is no private corpus: everything on the site and everything uploaded to S3 for VEDAL counts as public-corpus material and must reach Vedalina's index/RAG. |

At the MVP stage Vedalina has a single knowledge source: published site pages,
product cards, news, documents and the files uploaded to S3 as VEDAL materials.
If the customer later hands over genuinely closed documents, that will be
a separate mode with its own access policy — not today's behaviour.

The upload and indexing scheme is described in detail in
[vedalina_rag_pipeline.en.md](vedalina_rag_pipeline.en.md).

## S3 / Object Storage

| Bucket | Purpose | Openness |
| --- | --- | --- |
| `vedal-media` | photos, background images, open site media | may be served publicly for the site |
| `vedal-documents` | VEDAL document files and card attachments | at MVP everything uploaded here counts as indexable for Vedalina; direct bucket listing can stay closed — serving and indexing is done by the portal |
| `c3ag-media` | the neighbouring C3AG project's media | not related to VEDAL |

Important: a closed direct bucket is not the same as a closed document. The
bucket may hide its file list from the outside, and the portal still reads it
with a service key, publishes the allowed links and feeds the contents into RAG.

## Swagger

Swagger is currently reachable through the stand:

- `http://51.250.31.97:18080/swagger-ui/index.html`
- `http://51.250.31.97:18080/v3/api-docs/vedal-public`
- `http://51.250.31.97:18080/v3/api-docs/vedal-admin`

Convenient for current development: Michael, Egor and integrations see the API
contract. Before a real production move, one of the options must be chosen:

1. keep Swagger available to the team's current IPs only;
2. serve Swagger over VPN / an SSH tunnel;
3. switch public Swagger off and keep the contract in CI artifacts / the repository.

## Domain and DNS

Before switching the main `vedal-med.ru`, it is safer to first ask for access
to the DNS zone or for a temporary subdomain to verify against:

- `stage.vedal-med.ru` or `new.vedal-med.ru` → `51.250.31.97`;
- lower the record TTL to `300` seconds a few hours before the switch;
- do not touch the mail MX records if only the site is moving;
- confirm who performs the final rollback to the old site if it comes to that.

Credentials for the mail and the old WordPress admin are not the same as access
to DNS. Moving the site needs access to the registrar / Cloud DNS, or an action
by the responsible system administrator.

## The target production perimeter

Once access to `vedal-med.ru` is granted and HTTPS is configured, the normal
scheme becomes:

| Purpose | Target address | Ports exposed |
| --- | --- | --- |
| Site, forms, public Vedalina | `https://vedal-med.ru` | `80`, `443` |
| Staff sign-in | `https://auth.vedal-med.ru` or `/auth` behind the reverse proxy | `80`, `443` |
| Admin area | `https://vedal-med.ru/admin/` | `80`, `443` |
| SSH/DevOps | VPN or exact IPs on `2222` | never open to the world |
| PostgreSQL, Kafka, Debezium, the internal portal | docker network | not exposed |
| Object Storage | `https://storage.yandexcloud.net/vedal-media/...` plus service access to `vedal-documents` | not a VM port |

Then the temporary `18180` closes, and staff passwords stop travelling over
HTTP. Until that moment the stand login is fit for verification, but not for
day-to-day work with real personal data.
