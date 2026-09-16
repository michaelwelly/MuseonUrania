# Frontend Sitemap

[Русский](sitemap.md) · **English**

State of the public `vedal-med.ru` routes as of 16 September 2026.

## Global navigation

Visible items are ordered as About, Production, Products, Service, News, and
Contacts. Documents remains in the navigation configuration but is hidden by
the shared public-documents switch. The VEDAL mark in the header opens Home.

Persistent elements are the VEDAL mark, telephone number, contact button, and
Vedalina's floating button.

## Public routes

| Route | Page | State |
| --- | --- | --- |
| `/` | Home | published; the documents block is hidden |
| `/about/` | About | published; copy describing the tree as a marking sign was removed |
| `/production/` | Production | published; the video and photo archive link are off pending material approval |
| `/products/` | Products | published; T-100 is hidden |
| `/products/<slug>/` | Product detail | published products; the status badge and documents tab are hidden |
| `/service/` | Service | published; Organisation is required in the full form |
| `/news/` | News | published; the category-filter row is off |
| `/news/<slug>/` | News entry | published entries |
| `/contacts/` | Contacts | published; Organisation is required in the full form |
| `/legal/privacy/` | Data processing policy | published |
| `/documents/` | Documents | temporarily returns `404` at the customer's request; data has not been deleted |

`/production/archive/` was withdrawn pending material approval and permanently
redirects to `/production/`. Its restoration procedure is in the
[switch table](../operations/public_feature_switches.en.md).

## Permanent redirects

`frontend/next.config.ts` expands the table below into 39 permanent path
redirects. Next.js accepts each source with or without a trailing slash. The
fortieth rule applies to the host name and is described after the table.

| Canonical address | Sources |
| --- | --- |
| `/` | `/home`, `/main`, `/index`, `/glavnaya` |
| `/about/` | `/about-us`, `/o-kompanii`, `/o-nas`, `/company`, `/partners` |
| `/production/` | `/proizvodstvo`, `/manufacturing`, `/production/archive` |
| `/products/` | `/product`, `/catalog`, `/katalog`, `/produkciya`, `/produktsiya` |
| `/service/` | `/servis`, `/service-request`, `/support` |
| `/news/` | `/new`, `/novosti`, `/press`, `/blog` |
| `/contacts/` | `/contact`, `/contact-us`, `/kontakty`, `/kontakti` |
| `/legal/privacy/` | `/legal`, `/privacy`, `/privacy-policy`, `/policy`, `/politika-konfidencialnosti` |
| `/products/vedal-r1/` | `/products/vedal-r1-r2` |
| `/` | `/en`, `/en/:path*`, `/zh`, `/zh/:path*` |
| `/:path*/` | `/ru/:path*` — the same path without the Russian prefix; this also covers `/ru` |

English and Chinese addresses lead to Russian Home because approved content
translations do not exist. The Russian prefix preserves the path:
`/ru/products/` → `/products/`.

`next.config.ts` also contains a host rule from `www` to the address without
`www`, but the production gateway does not preserve the original `Host`, so the
rule does not remove the domain duplicate at the current perimeter. The
canonical redirect must be configured in nginx; the issue remains open until
then.

## Deferred routes

| Route | Page | Reason to defer |
| --- | --- | --- |
| `/technology/` | R&D and technology | R&D and public claims require approval |
| `/cases/` | Cases | customer consent and confirmed materials are required |
| `/en/`, `/zh/` | Website translations | approved content translations are missing; the addresses currently redirect |
| `/hi/` | Hindi version | a later market-entry phase |
| `/knowledge/` | Internal knowledge portal | closed contour, not a public release |

No public page may publish unapproved prices, availability, delivery dates,
clinical outcomes, certificates, or registration status.
