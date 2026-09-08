# Switching Vedalina to YandexGPT

[Русский](yandexgpt_activation.md) · **English**

## What the code already does

`VEDAL_ASSISTANT_ENGINE=yandexgpt` turns YandexGPT into a wording layer on top of
the local safe search. `DeterministicSearch` picks only the sources allowed for
the current contour first; the model then receives an already prepared
`APPROVED_CONTEXT`.

If there are no sources, nothing is sent to YandexGPT at all: the visitor gets
the regular handoff to a human.

## Environment variables

```env
VEDAL_ASSISTANT_ENGINE=yandexgpt
VEDAL_YANDEXGPT_MODEL_URI=gpt://<folder_id>/yandexgpt/latest
VEDAL_YANDEXGPT_API_KEY=<service account api key>
VEDAL_YANDEXGPT_TEMPERATURE=0.2
VEDAL_YANDEXGPT_MAX_TOKENS=600
VEDAL_YANDEXGPT_FALLBACK=true
```

Never keep the key in Jira, GitHub, email or the repository. Hand it over
through a protected channel only and put it into `backend/.env` on the VM
or into CI secrets.

## Smoke test after switching

```bash
curl -sS http://51.250.31.97:18080/api/assistant/v1/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"какой инкубатор есть для новорождённых?"}'
```

The response must contain:

- `answer` with Vedalina's text;
- a non-empty `sources`;
- no `handoff`, provided a published source was found.

## MVP limits

This is not yet full RAG over PDFs. The model neither reads closed files nor
indexes document chunks. Full RAG comes as the next layer: text extraction,
`public/internal/confidential` classification, pgvector, indexing and access
rights.
