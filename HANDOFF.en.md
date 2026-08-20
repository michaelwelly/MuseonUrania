# Frontend Handoff

[Русский](HANDOFF.md) · **English**

## Start Here

Use this repository as the project handoff for the VEDAL website redesign and Vedalina assistant concept.

Primary frontend package:

- `docs/frontend/README.md`
- `docs/frontend/claude_context_bundle.md`
- `docs/frontend/sitemap.md`
- `docs/frontend/content_model.md`
- `docs/frontend/page_briefs.md`
- `docs/frontend/implementation_checklist.md`
- `docs/operations/egor_handoff_tasks.md`

## Prototype And Assets

Prototype:

- `prototypes/vedalina-web-interface.html`

Vedalina assets:

- `assets/vedalina/vedalina-avatar-concepts-v1.png`
- `assets/vedalina/vedalina-avatar-middle-v1.png`
- `assets/vedalina/vedalina-web-integration-mockup-v1.png`

Recommended MVP avatar:

- `assets/vedalina/vedalina-avatar-middle-v1.png`

## Presentation

Latest deck:

- `outputs/vedal_frontend_design_pipeline_v3_urania_visuals.pptx`
- `outputs/vedal_frontend_design_pipeline_v3_urania_visuals.pdf`

## Current Scope

First release focus:

- Redesign home/title page.
- Build product/catalog structure.
- Add Vedalina assistant slot and floating button.
- Prepare quote/catalog/service forms for CRM handoff.
- Keep Smart Solution as a secondary integration layer.

Deferred:

- Full CRM rollout.
- Full S3 document system.
- Internal AI/RAG platform.
- VLM production/service pilot.

## Hard Rules

- Do not invent medical claims.
- Do not invent prices.
- Do not invent certifications or registration status.
- Do not expose private/internal documents.
- Vedalina must not provide diagnosis or treatment advice.
- Use placeholders such as `ожидает уточнения` where NN answers are missing.
