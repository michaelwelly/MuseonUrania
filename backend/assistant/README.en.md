# assistant

[Русский](README.md) · **English**

The public assistant Urania. The specification is
[urania_assistant_spec.en.md](../../docs/strategy/urania_assistant_spec.en.md),
its place in the architecture is the
[backend spec](../../docs/superpowers/specs/2026-08-06-vedal-portal-architecture-design.en.md).

Code: `src/main/java/ru/vedal/portal/assistant/`.

There is one door: `POST /api/assistant/v1/ask`. The response carries text and a
list of sources.

## Why the limits are not in the prompt

The hard prohibitions — no diagnosis, no treatment advice, no invented prices,
delivery times, specifications or registration statuses — live in `Guardrails`,
before the engine is called. A prompt is a request to the model, not a guarantee;
a check placed before the engine does not depend on which model sits behind the
port.

A separate trap: in Java the `\b` word boundary is governed by
`UNICODE_CHARACTER_CLASS`, that is the `(?U)` flag. With a lowercase `u`
(`UNICODE_CASE`) the Cyrillic rules **silently fail**. `GuardrailsTest` checks
exactly this.

## Why closed materials are unreachable

`LlmEngine` only goes through its neighbours' interfaces — `CatalogQuery`,
`ContentQuery`, `DocumentQuery` — and those return published items exclusively.
An unpublished product, a draft news item and an unapproved document physically
cannot enter the answer context, so the assistant cannot be talked into showing
them.

No suitable sources means no answer: it hands off to a human with contacts and a
list of forms. Inventing an answer is forbidden.

## The port and what comes next

`LlmEngine` is currently a deterministic word search, without a model. The full
implementation is YandexGPT + pgvector and the pipeline from the spec (text
extraction → chunks with metadata → embeddings). The domains do not look behind
the port, so changing the implementation does not touch them.

The log records the outcome of a request and the number of sources, **without the
text of the question**: a visitor may name both a clinic and themselves in it.

## Build module

`portal-assistant` is a Maven module with its own `pom.xml` and its own `src/`.
It depends on: `common`, `audit`, `catalog`, `content`, `documents`.

Only the neighbours' query interfaces — `CatalogQuery`, `ContentQuery`,
`DocumentQuery`. They return published material only, which is why closed
materials are physically unreachable for Urania.

The boundary is enforced by the build rather than by discipline: importing
from a module that is not among the dependencies fails compilation. Previously
all the code sat in one heap under `backend/src/`, and the boundaries held
only as long as someone was paying attention.
