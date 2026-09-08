# Vedalina: how the RAG corpus is built

[Русский](vedalina_rag_pipeline.md) · **English**

Recorded on 2026-08-27.

At the MVP stage VEDAL has no separate private document corpus. Vedalina's
knowledge corpus is therefore built from the public website and from every
material Michael uploads to S3 / the portal for VEDAL.

## Where documents go

A document cannot be dropped straight into S3 and considered searchable.
Two parts are required:

1. the file in Object Storage;
2. the document card in PostgreSQL.

The correct upload points:

| Material | Where it goes | What must appear in the database |
| --- | --- | --- |
| Photos, background images, site media | `vedal-media` | a link in the page, product or news card |
| PDFs, catalogs, brochures, licences, product descriptions | `vedal-documents` | a `document` row: title, product, language, type, status, `storage_key` |
| Website page text | CMS / admin area | a page / news / product row |

On the stand, uploads must go through the admin area or the import script.
Then the portal itself puts the file into S3, stores `storage_key` in
PostgreSQL and hands the material to Vedalina for indexing.

## How the pipeline works

```text
Admin area / import
  -> S3: the file
  -> PostgreSQL: the document card
  -> indexing queue
  -> text extraction from PDF/DOCX/HTML
  -> chunks of 500-1000 tokens with overlap
  -> embeddings
  -> PostgreSQL + pgvector
  -> top-k chunk search
  -> YandexGPT receives the question plus the chunks found
  -> Vedalina's answer with links to the sources
```

## PostgreSQL and pgvector

We use a single PostgreSQL in Docker, but the image must support the `pgvector`
extension. The database will gain tables like:

- `knowledge_source` — a document, page, news entry or product;
- `knowledge_chunk` — a text fragment with metadata;
- `embedding` / a vector column — the vector used to find similar fragments.

Chunk metadata:

- `source_type`: `page`, `product`, `news`, `document`;
- `source_id` or `slug`;
- `title`;
- `product_slug`;
- `language`;
- `url`;
- `updated_at`;
- `checksum`.

`checksum` is what keeps an unchanged file from being reindexed.

## How this relates to YandexGPT

YandexGPT does not store our documents. It only receives temporary context at
the moment of answering:

1. a visitor writes a question;
2. the backend turns the question into an embedding;
3. PostgreSQL/pgvector finds the nearest chunks;
4. the backend assembles the prompt: Vedalina's rules + the excerpts found + the question;
5. YandexGPT generates an answer;
6. the backend checks the guardrails and returns the answer to the site.

If there are no similar chunks, Vedalina does not invent an answer — she hands
the question over to a specialist.

## What is indexed today

Indexed:

- public website pages;
- published products;
- news;
- documents uploaded for the site;
- PDFs, brochures and catalogs Michael adds to S3 and registers in the portal.

Not indexed:

- passwords, keys, contractual secrets and accounts;
- drafts, unless marked as site material;
- personal data from leads;
- chat logs and the service audit trail.

If VEDAL later hands over restricted documents, we introduce a second indexing
contour with access rights. At this stage the whole corpus handed over for the
site is treated as Vedalina's public corpus.

## Which ports are needed

RAG does not require exposing PostgreSQL, Kafka or S3 keys to the outside.

Only these need to face outward:

- site/API: `18080` on the current stand, then `443`;
- Keycloak for staff sign-in: `18180` temporarily, then HTTPS over the domain;
- SSH: `2222`, restricted to exact IPs / VPN.

Everything else works inside the VM or over outbound HTTPS:

- the backend reads S3 with a service key;
- the backend calls YandexGPT over HTTPS;
- PostgreSQL/pgvector lives in the Docker network;
- Kafka and the indexing queue live in the Docker network.

## Nearest implementation steps

1. Move the PostgreSQL container to an image with `pgvector`.
2. Add the `knowledge_source` and `knowledge_chunk` migrations.
3. Add a text-extraction service for PDF/DOCX.
4. Add an indexing queue triggered by document uploads and page edits.
5. Wire up YandexGPT embeddings or a compatible embedding API.
6. Teach `YandexGptLlmEngine` to take context from `pgvector`, not only from
   the current deterministic search.
7. Add a "reindex" button in the admin area and an indexing status per document.
