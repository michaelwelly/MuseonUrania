# Frontend Implementation Checklist

[Русский](implementation_checklist.md) · **English**

## Before Design

- Confirm NN answers for site quiz.
- Confirm final product list.
- Confirm public document rules.
- Confirm assistant name Vedalina.
- Confirm avatar direction.
- Confirm whether Vedalina appears in hero, floating button, or both.
- Confirm Smart Solution wording.

## Design Package

- Sitemap approved.
- Page briefs approved.
- Content model approved.
- Product card model approved.
- Vedalina assistant states approved.
- Three frontend variants prepared.
- One variant selected for implementation.

## Frontend Build

- Responsive header.
- Home hero with CTA.
- Vedalina hero card.
- Vedalina floating button.
- Products page.
- Product detail template.
- Documents page.
- Press page.
- Service form.
- Contact forms.
- Footer.

## Integration Readiness

- Forms structured for CRM handoff.
- Media fields structured for S3 URLs.
- Documents marked public/internal/confidential.
- Product metadata present.
- Analytics events named.
- Vedalina quick actions wired to frontend states.

## Analytics Events

Event names:

- `hero_quote_click`
- `hero_catalog_click`
- `product_card_open`
- `product_quote_click`
- `document_download_click`
- `vedalina_open`
- `vedalina_quick_action_click`
- `service_form_submit`
- `quote_form_submit`
- `catalog_form_submit`

### How they are sent

Clicks are marked up in the markup itself with
`data-analytics="goal_name"`. A single document-level handler
(`frontend/components/Analytics.tsx`) turns them into Metrica goals, so no
button, card or document link has to know that analytics exists at all. The
handler walks up to the nearest ancestor carrying the attribute, so a click
on a title inside a link is credited to the link.

Form submissions are the exception: the goal fires on an **accepted lead**,
not on the button click. Pressing “Send” with an empty phone number, or
while the backend is down, is not a form submission; counted as one, it
would inflate conversion by exactly the cases conversion is watched for. In
the form with a topic selector the goal follows the topic:
`quote_form_submit`, `catalog_form_submit`, `service_form_submit`.

### When the counter runs

Two conditions, both required:

1. the counter id is set — `VEDAL_METRIKA_ID` in the environment, which
   becomes `NEXT_PUBLIC_YANDEX_METRIKA_ID` inside the site;
2. the visitor pressed “Accept” in the cookie banner.

If either fails, the `mc.yandex.ru` script is not loaded at all, and goals
go nowhere without errors. An empty id is the working state of a developer
machine and of the staging host, not a failure.

`VEDAL_ANALYTICS_ORIGINS` is filled in together with the id — it lists the
Metrica origins in the site security policy. Let those two variables drift
apart and the counter will load and silently count nothing.

Webvisor is off: it records page content, including what a person typed into
a form. The consent banner promises anonymised statistics, and the promise
has to be true.

### The map on the contacts page

`/contacts/` carries an embedded Yandex map, and it lives by the same rule as
the counter: the frame is created only after “Accept” in the cookie banner.
The banner asks one question for both — a person answers the same thing:
whether data about the visit goes to Yandex.

One difference from the counter: the map needs neither an id nor an
environment variable. The `yandex.ru/map-widget/v1` widget requires no API
key, the frame URL is built from `site.address`, and the map is identical on
production, on the staging host and on a developer machine. It is removed by
editing a single line — `mapEmbedded` in `frontend/lib/maps.ts`; the question
disappears from the banner along with it.

Without consent the frame's place keeps what was there before the map: the
CSS route scheme and a working “Построить маршрут” link to Yandex Maps at the
production address. That is not a “switch on cookies” stub but a full
fallback, and it is the one that sits in the static markup — the crawler and
a browser with JS off see it.

In the security policy the map needs one source — `frame-src` with
`https://yandex.ru` and `https://yandex.com` in
[backend/proxy/Caddyfile](../../backend/proxy/Caddyfile). It is spelled out
rather than kept in a variable: the map does not depend on the deployment.
Forget it and you get an empty rectangle instead of a map — the page stays
intact and the violation shows up only in the browser console.

## Safety QA

- No invented prices.
- No invented certificates.
- No unapproved clinical claims.
- No private documents in public UI.
- Vedalina does not answer as a doctor.
- Vedalina routes uncertain questions to a human.
- Consent/privacy text present before form submission.

## Visual QA

- Text fits on mobile and desktop.
- Hero does not hide the product/production message behind Vedalina.
- Vedalina is visible but secondary.
- Smart Solution is secondary to VEDAL.
- Product cards do not shift layout when content is missing.
- Buttons and forms are accessible.
