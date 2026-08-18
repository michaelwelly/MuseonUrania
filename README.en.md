# MuseonVedalina

[Русский](README.md) · **English**

> **Start here: [docs/PROJECT.en.md](docs/PROJECT.en.md)** — the general project
> documentation. The essence, the architecture, the repository layout, the
> current state, what is needed on both sides, the contradictions and the open
> questions. Every other document is detail.

Project workspace for the VEDAL medical equipment digital infrastructure
initiative.

## Running it

Docker is the only prerequisite — no Java, no Node, no Maven. Everything else
is built inside containers.

```bash
./scripts/up.sh
```

On Windows without bash, the same thing:

```
.\scripts\up.ps1
```

The script checks Docker, generates `backend/.env` with random passwords,
builds the images, waits for readiness and prints the addresses. **The first
run takes about ten minutes:** Maven downloads dependencies, Next builds the
pages. After that it is seconds — the layers are cached.

| Address | What |
| --- | --- |
| `http://localhost:8080` | the site |
| `http://localhost:8080/admin/` | the admin |
| `http://localhost:8080/swagger-ui.html` | API specification |
| `http://localhost:8180` | Keycloak |

Admin sign-in — `editor` / `editor-local`. This is a local-stack account,
created by the realm import and never deployed to a server; why the password
lives in the repository is explained in
[backend/keycloak/README.en.md](backend/keycloak/README.en.md).

To stop without losing data:

```bash
docker compose -f backend/compose.yaml --profile app down
```

What to do when something does not come up, how to run the applications from
your machine instead of containers, and how the development mode differs —
[docs/PROJECT.en.md, section 5.8](docs/PROJECT.en.md#58-environments-and-running-it).

The goal is to turn the current public presence of `vedal-med.ru` into a
production-ready sales and information platform, then expand it into a full
internal IT contour for a medical equipment manufacturer: CRM, media/document
storage, multilingual content, analytics, AI-assisted document search, and
future VLM/LLM workflows for office, sales, service, and production.

## Current Focus

1. Enrich the existing `vedal-med.ru` landing page with product, production,
   partner, and press-release content.
2. Build a structured product catalog for about 10 products.
3. Request missing materials from Nikolay Nikolaevich: product catalog, Innoprom
   materials, cloud photo/video link, product documentation, and sensitivity
   classification guidance.
4. Design cloud infrastructure with S3-compatible media/document storage, CRM,
   analytics, private employee contour, and AI-ready data pipelines.
5. Prepare multilingual public content in Russian, English, Chinese, and later
   Hindi.

## Repository Layout

Monorepo: `frontend/` (public site + Vedalina UI), `backend/` (API, forms/CRM
handoff), `docs/`, `assets/`, `prototypes/`, `outputs/`.

Branches:

- `main`: released, finished work only;
- `dev`: integration branch, everything is reviewed here first;
- `front`: frontend work, merges into `dev`;
- `back`: backend work, merges into `dev`;
- `db`: migrations and seed data, merges into `dev`;
- `infra`: build, CI/CD, Docker, deployment, merges into `dev`;
- `docs`: documentation, merges into `dev`.

Documentation rules — [docs/documentation_rules.en.md](docs/documentation_rules.en.md),
branch rules — [docs/PROJECT.en.md, section 4](docs/PROJECT.en.md#4-branches).

## Key Documents

- [General project documentation](docs/PROJECT.en.md) — single entry point, brings everything else together
- [Documentation rules](docs/documentation_rules.en.md) — bilingual convention, glossary, checks
- [VEDAL Portal: closed contour and CRM](docs/architecture/vedal_portal_owner_brief.en.md) — target architecture; outranks the other documents when they disagree
- [Backend architecture](docs/superpowers/specs/2026-08-06-vedal-portal-architecture-design.en.md) — technical decisions, accepted and rejected
- [Product documentation](docs/products/README.en.md) — VEDAL R1/R2, A-2000, Т-100 datasheets
- [Egor handoff tasks and work split](docs/operations/egor_handoff_tasks.en.md)
- [Frontend handoff](HANDOFF.en.md)
- [Frontend handoff package](docs/frontend/README.en.md)
- [Project brief](docs/strategy/project_brief.en.md)
- [Functional requirements](docs/strategy/functional_requirements.en.md)
- [Infrastructure architecture](docs/architecture/infrastructure_architecture.en.md)
- [Content and SEO plan](docs/strategy/content_and_seo_plan.en.md)
- [Competitor notes](docs/strategy/competitor_notes.en.md)
- [Frontend design handoff](docs/strategy/frontend_design_handoff.en.md)
- [Frontend variants](docs/strategy/frontend_variants.en.md)
- [Vedalina assistant spec](docs/strategy/vedalina_assistant_spec.en.md)
- [Vedalina visual assets](docs/strategy/vedalina_visual_assets.en.md)
- [Vedalina web prototype](prototypes/vedalina-web-interface.html)
- [Request to Nikolay Nikolaevich](docs/requests/nikolay_materials_request.en.md)
- [Presentation outline for Nikolay Nikolaevich](docs/strategy/nn_presentation_outline.en.md)
- [Roadmap](docs/operations/roadmap.en.md)
- [7-person team estimate](docs/operations/team_estimate_7_people.en.md)

## Source Notes

Initial input came from a voice-style brief plus the handwritten photo at
`/Users/michaelwelly/Downloads/IMG_7136.heic`.
