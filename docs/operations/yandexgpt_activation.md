# Включение Ведалины через YandexGPT

**Русский** · [English](yandexgpt_activation.en.md)

## Что уже делает код

`VEDAL_ASSISTANT_ENGINE=yandexgpt` включает YandexGPT как слой формулировки ответа
поверх локального безопасного поиска. Сначала `DeterministicSearch` выбирает
только разрешённые источники для текущего контура, потом модель получает уже
подготовленный `APPROVED_CONTEXT`.

Если источников нет, запрос в YandexGPT не уходит: пользователь получает штатную
передачу специалисту.

## Переменные окружения

```env
VEDAL_ASSISTANT_ENGINE=yandexgpt
VEDAL_YANDEXGPT_MODEL_URI=gpt://<folder_id>/yandexgpt/latest
VEDAL_YANDEXGPT_API_KEY=<api-key сервисного аккаунта>
VEDAL_YANDEXGPT_TEMPERATURE=0.2
VEDAL_YANDEXGPT_MAX_TOKENS=600
VEDAL_YANDEXGPT_FALLBACK=true
```

Ключ не хранить в Jira, GitHub, почте и репозитории. Передавать только
защищённым каналом и класть в `backend/.env` на ВМ или в секреты CI.

## Smoke-test после включения

```bash
curl -sS http://51.250.31.97:18080/api/assistant/v1/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"какой инкубатор есть для новорождённых?"}'
```

В ответе должны быть:

- `answer` с текстом Ведалины;
- непустой `sources`;
- без `handoff`, если найден опубликованный источник.

## Поиск по близости (pgvector)

Схема, индексация и поиск по близости уже написаны и лежат рядом —
подробности в [vedalina_rag_pipeline.md](vedalina_rag_pipeline.md). Включаются
отдельной парой переменных, ключ тот же:

```env
VEDAL_RAG_ENABLED=true
VEDAL_RAG_DOCUMENT_MODEL_URI=emb://<folder_id>/text-search-doc/latest
VEDAL_RAG_QUERY_MODEL_URI=emb://<folder_id>/text-search-query/latest
```

Включать можно и до корпуса: пустой индекс ничего не находит, и ассистент
отвечает прежним поиском по словам. Смысла в этом, впрочем, пока немного —
поэтому по умолчанию выключено.

## Ограничения MVP

Это ещё не полный RAG по PDF: извлечения текста из файлов нет, и потому
в индекс попадает только то, что портал и так показывает, — изделия, новости
и карточки документов. Модель не читает закрытые файлы: материал уровня
`confidential` в индекс не попадает вовсе, его нет даже значением в схеме.

Что осталось до полного RAG: извлечение текста из PDF и DOCX, очередь
индексации после загрузки документа, кнопка переиндексации в админке
и калибровка порога близости на настоящих документах.
