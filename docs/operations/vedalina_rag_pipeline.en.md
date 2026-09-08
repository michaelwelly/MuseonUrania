# Vedalina: how the RAG corpus is built

[Русский](vedalina_rag_pipeline.md) · **English**

Recorded on 2026-08-27, updated on 2026-09-08.

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

Done. A single PostgreSQL on the `pgvector/pgvector:pg16` image — the same
PostgreSQL 16 as before, plus the extension. The schema is created by the
`V34__knowledge_vectors.sql` migration, whose first statement is
`create extension if not exists vector`. In Managed PostgreSQL the extension is
enabled from the cloud console, and there that statement is a no-op.

Two tables.

`knowledge_source` — a portal material:

| Column | What it holds |
| --- | --- |
| `kind` | `product`, `news`, `document`, `page` |
| `external_id` | the material's slug in its own module; unique together with `kind` |
| `title`, `url` | what to show under the answer and where to send the reader |
| `visibility` | `public` or `internal` |
| `language` | the material's language |
| `checksum` | fingerprint of the text: unchanged means no reindexing |
| `indexed_at` | when it was indexed |

`knowledge_chunk` — a fragment and its vector:

| Column | What it holds |
| --- | --- |
| `source_id` | the material; deleting it cascades to the chunks |
| `position` | the fragment's number within the material |
| `text` | the fragment itself — exactly what reaches the model's context |
| `model` | which model produced the vector |
| `embedding` | `vector(256)` |

Two indexes: `hnsw (embedding vector_cosine_ops)` for similarity search and a
plain one on `source_id` for reindexing. HNSW rather than IVFFlat: the latter
builds its lists from existing data and is meaningless on an empty table — it
would have to be created by a separate migration on the day the corpus arrives.

What the schema deliberately lacks:

- **a `confidential` level.** §7.4 hands such documents out "only by separate
  permission", and a staff login is not a separate permission. Such material
  does not enter the index at all — it is not filtered out on retrieval, it is
  physically absent. A retrieval filter would eventually be forgotten in some
  new query; a row that does not exist cannot be forgotten;
- **a second column for another dimension.** Vectors from different models are
  incomparable, and there is nothing to compare them with anyway. Changing the
  embedding model means a separate migration and a full reindex.

`checksum` is computed over the text together with the title, the URL and the
**model name**: a PDF's metadata and date change while its text stays the same,
so a fingerprint over the file bytes would force reindexing of unchanged
material. The model name is in the fingerprint so that changing the model does
not leave the old vectors in the index as dead weight.

## Dimension and model

Embeddings come from Yandex Foundation Models, the
`foundationModels/v1/textEmbedding` endpoint, using the same key as YandexGPT.

There are **two** models, and that is not duplication: `text-search-doc`
encodes document fragments, `text-search-query` encodes questions. They are a
pair — the vectors land in one space precisely because the models differ.
Mixing them up is not a failure but a quietly corrupted result set.

The vector length is 256, and that number is baked into the column type:
pgvector requires a dimension, otherwise the column cannot be indexed. The
portal does not take the number on trust — the length of the returned vector is
checked against the expected one, and a mismatch fails the indexing with a
readable message. Otherwise a model change would show up not as a failure but
as answers getting worse.

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

Today, before the corpus, what gets indexed is what the portal already shows:
published products, news and document cards. It is taken through the same
neighbour query interfaces as the word search uses — not a single new field and
not a single new source.

Files (PDFs, brochures, catalogues) are not indexed yet: text extraction from
them does not exist. The list below is the target state.

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

## What is done and what waits for the corpus

State as of 8 September 2026,
[issue #38](https://github.com/michaelwelly/MuseonUrania/issues/38).

Done — everything that does not depend on the documents' content:

1. PostgreSQL moved to an image with `pgvector`; the tests start the same image.
2. Migration `V34` creates `knowledge_source` and `knowledge_chunk`.
3. Chunking with overlap (`Chunks`).
4. The `Embeddings` port and its `YandexEmbeddings` implementation.
5. Indexing with a checksum (`KnowledgeIndex`): unchanged material costs not a
   single model call.
6. Similarity search with a threshold and the `PUBLIC` / `STAFF` scopes
   (`VectorSearch`).
7. A handover rather than a replacement (`RagRetrieval`): nothing found in the
   index means the previous word search answers.
8. Reindexing of what the portal already shows — products, news and document
   cards.

Waiting for the corpus:

1. **Text extraction from PDF and DOCX.** Parsing files is verified with files,
   and inventing the contents of VEDAL datasheets for a test is forbidden by the
   project rules.
2. **An indexing queue** triggered by document uploads and page edits. Today
   reindexing is invoked as a method; the `vedal.documents.v1` event already
   exists, a consumer does not.
3. **A "reindex" button in the admin area** and an indexing status per document.
4. **Calibration of the `vedal.assistant.rag.max-distance` threshold.** The
   default of 0.45 is deliberately provisional: a threshold can only be measured
   against real documents and real questions.
5. **A second indexing circuit** for restricted material, should VEDAL hand any
   over.

## The empty index

This is the key property of what has been built, and it is covered by tests.

An empty index is a working state, not a placeholder. Searching it returns zero
rows, `RagRetrieval` hands the question to the word search, and the assistant
answers exactly as it did before pgvector. No failure, no invented answer.

An empty index also costs nothing: before turning the question into a vector —
which is a model call, that is, a bill — the portal asks the database whether
there is anything to search at all. Until the corpus exists, that is the only
query added to the previous behaviour.

The same goes for the cloud falling silent: an embeddings failure means "the
vector search found nothing", not "the assistant is broken".

## How to switch it on

Off by default. There is nothing to index, and every question would cost an
embeddings call for a knowingly empty result.

```env
VEDAL_RAG_ENABLED=true
VEDAL_RAG_DOCUMENT_MODEL_URI=emb://<folder_id>/text-search-doc/latest
VEDAL_RAG_QUERY_MODEL_URI=emb://<folder_id>/text-search-query/latest
VEDAL_RAG_MAX_DISTANCE=0.45
```

No separate key is needed — `VEDAL_YANDEXGPT_API_KEY` is used: embeddings live
in the same Foundation Models and are billed to the same service account.

A half-configured setup fails the startup with a readable message: an enabled
mode without a key is a portal quietly working at half capacity, and the only
way to notice would be the answers getting worse.
