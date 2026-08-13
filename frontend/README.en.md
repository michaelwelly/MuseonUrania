# Frontend

[Русский](README.md) · **English**

The public website `vedal-med.ru` and the Urania assistant. Next.js 16, App
Router, TypeScript, CSS Modules.

## Running it

```bash
npm run dev
```

With no configuration it comes up on local content — no backend, no database and
no Docker required. To work against the server side, copy
[.env.example](.env.example) to `.env.local`.

## Where the data comes from

The catalog, the news and the documents are read from the public API at build
time and refreshed every five minutes — the same window the backend puts in
`Cache-Control`. That is why a backend outage does not take an already built
site down. A live backend is needed only by the forms and by Urania: they call
from the browser.

| `NEXT_PUBLIC_API_URL` | Catalog, news, documents | Forms and Urania |
| --- | --- | --- |
| unset | `content/*.ts` | say plainly that submission is not wired; Urania answers with local prompts |
| set | the public API; if it does not answer, **the build fails** | `POST /api/forms/v1/leads` and `POST /api/assistant/v1/ask` |

The build fails on purpose: silently substituting the hardcoded catalog is more
dangerous than not building — an unpublished item would go to production.

The backend has to allow the site's origin: the `VEDAL_ALLOWED_ORIGINS` variable
on its side, see [backend/README.en.md](../backend/README.en.md).

## What is done

Nine screens of the site, the Urania chat, the lead forms. The markup comes from
[prototypes/urania-web-interface.html](../prototypes/urania-web-interface.html),
the requirements from [docs/frontend](../docs/frontend).

## Structure

- `app/` — routes and global styles.
- `components/` — header, footer, forms, assistant blocks.
- `lib/api.ts` — reading the public API on the server.
- `lib/submit.ts` — sending leads and Urania questions from the browser.
- `content/*.ts` — all site text and the fallback data source. Unconfirmed facts
  are marked `AWAITING`.

## Content rules

Do not invent prices, specifications, certificates or clinical claims
([HANDOFF.en.md](../HANDOFF.en.md)). Missing data is marked `ожидает уточнения`
in `content/site.ts`.

Work happens in the `front` branch.
