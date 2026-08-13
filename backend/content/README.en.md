# content

[Русский](README.md) · **English**

News and the press centre. The module came out of the
[architecture spec](../../docs/superpowers/specs/2026-08-06-vedal-portal-architecture-design.en.md);
it was not in the original module list.

Code: `src/main/java/ru/vedal/portal/content/`.

It exposes a single interface — `ContentQuery`: the feed of published items and a
single publication. [assistant](../assistant/README.en.md) uses the same
interface, so an unpublished draft cannot reach an assistant answer.

`published` and `published_on` are different things: the first controls
visibility, the second sets the date in the feed. Material is prepared in advance
and published later. A published record without a date is forbidden by a schema
constraint.

## Having no data is a normal state

`frontend/content/news.ts` is empty: the Innoprom materials are still listed as
"Awaiting NN" (see
[nikolay_materials_request.en.md](../../docs/requests/nikolay_materials_request.en.md)),
and the demo publications from the mockup are not carried into production — a
direct instruction from [HANDOFF.en.md](../../HANDOFF.en.md). So the module has no
seed: an empty feed returns `[]`, and the first record is added by an editor
through the admin panel.

A publication slug is restricted to Latin characters: it goes into the public URL.
