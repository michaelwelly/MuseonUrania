# Frontend

[Русский](README.md) · **English**

The public website `vedal-med.ru` and the Urania assistant. Next.js 16, App
Router, TypeScript, CSS Modules.

## Running it

```bash
npm run dev
```

## What is done

The first screen of the home page: header, hero, Urania card, floating assistant
button. The markup comes from
[prototypes/urania-web-interface.html](../prototypes/urania-web-interface.html),
the requirements from [docs/frontend](../docs/frontend).

## Structure

- `app/` — routes and global styles.
- `components/` — header and assistant blocks.
- `content/site.ts` — all page text. Unconfirmed facts are marked `AWAITING`.

## Content rules

Do not invent prices, specifications, certificates or clinical claims
([HANDOFF.en.md](../HANDOFF.en.md)). Missing data is marked `ожидает уточнения`
in `content/site.ts`.

Work happens in the `front` branch.
