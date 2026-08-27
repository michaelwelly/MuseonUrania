# Включение Ведалины через YandexGPT

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

## Ограничения MVP

Это ещё не полный RAG по PDF. Модель не читает закрытые файлы и не индексирует
чанки документов. Полный RAG добавляется следующим слоем: извлечение текста,
классификация `public/internal/confidential`, pgvector, индексация и права
доступа.
