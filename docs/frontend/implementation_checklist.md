# Frontend Implementation Checklist

## Before Design

- Confirm NN answers for site quiz.
- Confirm final product list.
- Confirm public document rules.
- Confirm assistant name Urania.
- Confirm avatar direction.
- Confirm whether Urania appears in hero, floating button, or both.
- Confirm Smart Solution wording.

## Design Package

- Sitemap approved.
- Page briefs approved.
- Content model approved.
- Product card model approved.
- Urania assistant states approved.
- Three frontend variants prepared.
- One variant selected for implementation.

## Frontend Build

- Responsive header.
- Home hero with CTA.
- Urania hero card.
- Urania floating button.
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
- Urania quick actions wired to frontend states.

## Analytics Events

Suggested event names:

- `hero_quote_click`
- `hero_catalog_click`
- `product_card_open`
- `product_quote_click`
- `document_download_click`
- `urania_open`
- `urania_quick_action_click`
- `service_form_submit`
- `quote_form_submit`
- `catalog_form_submit`

## Safety QA

- No invented prices.
- No invented certificates.
- No unapproved clinical claims.
- No private documents in public UI.
- Urania does not answer as a doctor.
- Urania routes uncertain questions to a human.
- Consent/privacy text present before form submission.

## Visual QA

- Text fits on mobile and desktop.
- Hero does not hide the product/production message behind Urania.
- Urania is visible but secondary.
- Smart Solution is secondary to VEDAL.
- Product cards do not shift layout when content is missing.
- Buttons and forms are accessible.
