# chat — the visitor's conversation

[Русский](README.md) · **English**

The site widget, Vedalina's reply, and a staff member joining the thread.

## Why a separate module

A conversation is its own domain: it has state, an owner, a queue and a life
cycle. The assistant, by comparison, remembers nothing — question, answer, done.
Putting them in one module would mix an entity with no memory into one that
consists of nothing but memory.

Dependencies: `common`, `audit`, `assistant`. Answers come from
`AssistantService` rather than a second call into the engine, and that is the
point: Vedalina's limits — no diagnoses, no prices, published material only —
live in `Guardrails`. A second path to the engine would mean a second set of
limits, and one day the two would disagree.

## Why this is not a fourth entry point

The architecture has a rule: there are three entry points and a fourth is never
added. A chat is a write from outside, so at first glance it breaks the rule.

It does not. `POST /api/assistant/v1/ask` already accepts free text from an
anonymous visitor and already sits behind a rate limit. A conversation is that
same assistant entry point, with the answer no longer being a one-off and with
room for a human to step in. The perimeter is still checked where it was.

## Conversation states

| | |
| --- | --- |
| `open` | in progress, Vedalina answers |
| `waiting` | Vedalina handed off, no staff member has joined yet |
| `attended` | a staff member is in the conversation |
| `closed` | finished |

`waiting` is deliberately separate from `open`: it is the only state where a
person is waiting for a live answer, and the staff work queue is built from it.
Merging it into `open` would turn that queue into a list of every conversation
there is.

## The main rule

**Once a conversation is handed to a human, Vedalina goes silent.** Not "answers
less often", not "answers until a staff member joins" — silent, completely.

Otherwise you get a conversation where the machine talks over the person: the
staff member writes "let me check with an engineer", the visitor replies "fine,
I'll wait", and the assistant answers that with a catalogue summary. From the
visitor's side it looks like a staff member who does not read what he is sent.

`ChatDeskTest.assistantStaysSilentOnceAHumanIsInvolved` guards the rule.

## Three kinds of author

`visitor`, `assistant`, `staff` — not an "ours / not ours" flag. The visitor
must be able to see whether a machine or a person answered: passing off a
search result as a staff consultation is not acceptable under any circumstances.

## Personal data

The visitor is **anonymous**, identified by a random key the widget stores in
the browser; that key says nothing about the person — it identifies a tab.
Contacts and consent are taken when the conversation turns into a lead, not
before the first message: a "please introduce yourself" form turns away most of
the people who wanted to ask something quickly — and the person who asked is
the future lead.

**Message bodies never reach the audit log.** A visitor is free to type
anything into a free-text field, including a name and a phone number, and the
log is immutable — personal data cannot be cleaned out of it on request later.
The log records what happened and the conversation id, nothing else.

Message text can still become personal data, so a conversation is anonymised by
the same mechanism as a lead: the `erased_at` and `erasure_basis` columns.

## The question is accepted, the answer arrives later

`POST /chat` records the question and replies immediately — with a thread that
does not yet contain Vedalina's answer. The answer is computed separately
(`Answering`) and arrives over the stream.

The engine used to be called inside that same request, and it went unnoticed:
deterministic search answers in milliseconds. A model answers in seconds, and
the same code then causes three problems at once. The visitor stares at a
motionless window — the dots were drawn by the widget itself and went out on
every reload. Caddy and the gateway sit between the widget and the portal with
timeouts of their own: an answer that misses the deadline is lost to the visitor
while staying recorded in the database. And every hanging request holds a worker
thread — a dozen visitors hold all of them.

There is one exception: a pressed quick-reply button. Its text is known in
advance, and delaying it would mean acting out deliberation over a decision
made before the click.

Deliberation is state, not a message: the `answering` field in the thread and a
`typing` event with `who = assistant`. It lives in the thread because an event
is sent once and misses whoever subscribed later: a widget reopened in the
middle of the wait must show the dots again.

An answer that fails — engine unavailable, queue full — is not silence but a
handoff to a human, recorded with reason `failed`. Silence here means a visitor
waiting for an answer nobody is preparing.

## The whole thread, not an increment

`say` and `threadFor` return the entire conversation rather than the new
messages. Appending requires the client and the server to agree on where the
previous state ended — and when the connection drops they disagree.

## Schema

Tables `conversation` and `chat_message`, migration `V17__conversation.sql`.
A visitor key has at most one open conversation, enforced by the partial unique
index `conversation_visitor_open_idx`.
