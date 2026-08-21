# assistant

[Русский](README.md) · **English**

The public assistant Vedalina. The specification is
[vedalina_assistant_spec.en.md](../../docs/strategy/vedalina_assistant_spec.en.md),
its place in the architecture is the
[backend spec](../../docs/superpowers/specs/2026-08-06-vedal-portal-architecture-design.en.md).

Code: `src/main/java/ru/vedal/portal/assistant/`.

There are two doors: `POST /api/assistant/v1/ask` — a question, the response
carries text and a list of sources; `GET /api/assistant/v1/prompts` — the
quick-reply buttons for the widget.

## Why the buttons come from the portal

Button labels and their canned answers used to live in the interface.
Pressing one sent the label as a question — and the search answered
«Запросить КП» with a list of products whose descriptions happened to
contain a similar word. The «Специалист VEDAL» button called nobody.

The widget now sends `intent` — which button was pressed — instead of
relying on string equality: a label lives in the interface and changes with
it, and matching on it would drift silently. The texts are in
`ScriptedReplies`.

Free text deliberately does not reach them. Guessing intent from words
(«хочу КП» → the quote script) misfires on negation: «пока не нужно КП»
would get the same answer.

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
the port, so changing the implementation does not touch them. The scripted
replies will stay as the fast path for buttons: «Запросить КП» has a known
answer and does not need a model call.

What the search counts as a match: the brand (`vedal`, `ведал`) does not —
it stands in every product name, so it finds everything. A match in the name
weighs three times a match in the description, and there is a threshold:
one incidental word in a description is not enough. Failing the threshold is
a normal outcome — the conversation goes to a human; a product list assembled
from the word «для» is worse than an honest "I do not know".

The log records the outcome of a request and the number of sources, **without the
text of the question**: a visitor may name both a clinic and themselves in it.

## Build module

`portal-assistant` is a Maven module with its own `pom.xml` and its own `src/`.
It depends on: `common`, `audit`, `catalog`, `content`, `documents`.

Only the neighbours' query interfaces — `CatalogQuery`, `ContentQuery`,
`DocumentQuery`. They return published material only, which is why closed
materials are physically unreachable for Vedalina.

The boundary is enforced by the build rather than by discipline: importing
from a module that is not among the dependencies fails compilation. Previously
all the code sat in one heap under `backend/src/`, and the boundaries held
only as long as someone was paying attention.
