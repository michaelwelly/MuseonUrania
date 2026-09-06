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

## Who answers: the search or the model

Two implementations stand behind the `LlmEngine` port, selected by the
`vedal.assistant.engine` setting:

| Value | Who answers |
| --- | --- |
| `search` (default) | `DeterministicSearch` — a list of what was found, with links |
| `yandexgpt` | `YandexGptEngine` — a model on top of that same search |

**The model does not replace the search, it sits on top of it.** The portal
finds the materials: it has the catalogue, the news and the documents with
permissions applied, while the model has nothing except what we show it. If
nothing was found, the model is not asked at all: the rule "no published
sources, no answer" outweighs the urge to say something, and paying a model
to reply "I do not know" is paying for a refusal.

**Links are never asked of the model.** The sources under an answer are exactly
the materials the search found, in the same order. Let the model name them
itself and one day it will name a plausible page that does not exist. It only
places the markers `[1]`, `[2]` in the text; where a marker leads is decided by
the portal, and the widget turns it into a link.

**A silent model does not stop the conversation.** A cloud refusal, a timeout,
an empty reply — the list of found materials is returned instead, the very one
that existed before the model. The materials were found after all; making the
visitor wait for a human because of someone else's downtime is pointless.

**No key lives in the repository.** `VEDAL_YANDEX_API_KEY` and
`VEDAL_YANDEXGPT_MODEL_URI` (the full model address, `gpt://folder/model`)
come from the environment, and with `engine=yandexgpt`
the portal will not start without them — deliberately: otherwise it would
quietly answer with a list of links, and the substitution would only be
noticeable by the answers becoming drier.

What comes next: pgvector and the pipeline from the spec (text extraction →
chunks with metadata → embeddings). That changes the **search**, not the
generation: `YandexGptEngine` receives materials through
`DeterministicSearch.find`, so it can be swapped for a vector search without
touching the prompt or the conversation.

The scripted replies stay as the fast path for buttons: «Запросить КП» has a
known answer and does not need a model call.

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
