# Content Protection Requirements

[Русский](content_protection_requirements.md) · **English**

## Purpose

This document closes two thirds of item §1.5 of the customer plan dated
18 August 2026: copy restriction and the `public` / `internal` / `confidential`
document levels. The third part — domain cutover — lives in
[docs/operations/domain_cutover_vedal_med_ru.en.md](../operations/domain_cutover_vedal_med_ru.en.md),
because it has a different owner and a different lifetime.

What follows describes what leaves the site and for whom, which measures
constrain that today, and which decisions still belong to the customer.

## What this document does not promise

Absolute copy prevention does not exist in a browser, and §12 of the plan says
so outright. Screenshots, DevTools, the Network tab and the direct file URL stay
available to anyone who opens the page. None of the measures below close them,
and none claim to.

That leaves one honest split:

1. **Make accidental copying harder.** The material stays public, but it cannot
   be dragged away in one mouse movement. This works against carelessness, not
   against intent.
2. **Do not publish it at all.** The material never enters the public contour.
   This is the only measure that actually protects anything.

Anything that genuinely needs protection takes the second path. Measures of the
first kind are never presented to the customer as protection — only as hygiene.

## Three levels of material

The level is a mandatory property of every document, not a label left to the
editor's discretion.

| Level | Visible to | Where it lives |
| --- | --- | --- |
| `public` | everyone | public site, document listing, assistant answers |
| `internal` | an employee after login | closed contour, assistant search after login |
| `confidential` | nobody automatically | by separate decision only, outside the site |

`confidential` belongs to neither assistant search scope — not the public one,
not the staff one. This is not a query filter that a new entry point might
forget to apply: the level is cut off at the document selection boundary.

## Texts

**Text selection on the site is not disabled.** This is a deliberate decision,
not an omission. A procurement officer copying specifications into a tender bid
is our reader, not a thief; disabling selection breaks in-page search, screen
readers, machine translation and copying the phone number. The measure costs
more than it gives, because it does not stop deliberate copying anyway.

Requirements:

- a copyright notice — one line in the footer, on every page (implemented,
  `frontend/content/site.ts`);
- the page-wide context menu is not disabled — real people need it;
- sensitive text is not published; it moves to the `internal` level instead.
  A public page contains nothing that must not be copied.

## Images

Requirements and status:

- dragging and the context menu on `<img>` are intercepted (implemented,
  `frontend/components/ImageGuard.tsx` — listeners on the document rather than
  attributes on each image, otherwise protection becomes selective as soon as
  someone adds a new image);
- long press on iOS does not open "Save photo"
  (`-webkit-touch-callout: none`, `frontend/app/globals.css`);
- an optimized web format is served; shooting originals are not placed in the
  public contour;
- **watermark — awaiting the customer's decision.** Not implemented. We need
  confirmation of which images may carry one: on the booklet production shots it
  is questionable, because the booklet has already circulated without it.

## Documents

Requirements and status:

- the level (`sensitivity`) is a mandatory field, and the schema constraint
  admits only the three values (implemented, migration `V10__document.sql`);
- an `internal` or `confidential` document cannot appear in the public listing —
  enforced by a database constraint, not only by a query filter (implemented,
  `V21__listed_documents_are_public.sql`). A filter protects one read path; a row
  that should not be in the table will sooner or later find a second one — a
  report, an export, a new entry point;
- only a `public` document can be published (implemented, `DocumentEditor`);
- files are served through the application, never as a direct storage link;
- a restricted document answers `404`, not `403`: the response code must not
  reveal that such a document exists;
- downloads and access denials are recorded in the audit log
  (`document.download`, `document.access.denied`);
- no document is published until the customer approves it explicitly — §7.6 of
  the plan.

## Assistant

- there are exactly two search scopes: public, and staff after login;
- `confidential` belongs to neither — it is neither indexed nor quoted;
- every assistant request is recorded in the audit log (`assistant.ask`).

## Open items for the customer

1. Watermark: is it wanted, and on which materials is it acceptable.
2. The final list of documents approved for publication (§7.3 of the plan).
3. Sorting the handed-over folders into the three levels (§7.4 of the plan) —
   until that is done, no document gets published.

## Related documents

- [Compliance requirements](../legal/compliance_requirements_ru.md) — personal
  data, hosting, open and closed contours.
- [vedal-med.ru domain cutover](../operations/domain_cutover_vedal_med_ru.en.md).
- [Materials request to Nikolay Nikolaevich](../requests/nikolay_materials_request.en.md).
