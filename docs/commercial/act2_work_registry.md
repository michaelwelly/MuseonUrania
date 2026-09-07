# Реестр выполненных работ к акту №2

**Русский** · [English](act2_work_registry.en.md)

## Назначение

Документ поддерживает подготовку акта №2 (issue
[#40](https://github.com/michaelwelly/MuseonUrania/issues/40)) фактами из
репозитория: что сделано технически, чем это подтверждается, что осталось
и от кого это зависит. Реестр не заменяет сам акт: суммы, сроки и стоимость
в нём не указываются — это не его часть.

Состояние сверено на 7 сентября 2026 года с кодом ветки `dev` (сборка слоёв
`back`, `front`, `infra`, `docs`), как зафиксировано в
[docs/PROJECT.md, раздел 6](../PROJECT.md#6-текущее-состояние). Подтверждения
ниже — это конкретные маршруты API, тестовое покрытие и протокол сквозного
прогона стенда из issue
[#57](https://github.com/michaelwelly/MuseonUrania/issues/57) («Сквозной
прогон стенда перед сдачей», прогон от 7 сентября).

---

## 1. Публичный сайт

- Десять маршрутов сайта: `/`, `/products`, `/products/[slug]`,
  `/production`, `/documents`, `/news`, `/news/[slug]`, `/service`,
  `/about`, `/contacts`, плюс `/legal/privacy`. Тринадцать карточек
  продукции, пять категорий.
- Каталог, новости и документы читаются из Public API
  (`/api/public/v1/categories`, `/products`, `/products/{slug}`, `/news`,
  `/news/{slug}`, `/documents`, `/documents/{slug}/file`) на сборке сайта;
  падение бэкенда не роняет собранную статику.
- Карта сайта и `robots.txt`, собираемые из портала, своя иконка во вкладке.
- Карта сайта приведена в соответствие с фактическими маршрутами (issue
  [#59](https://github.com/michaelwelly/MuseonUrania/issues/59)).

**Подтверждение:** 353 теста фронтенда в 33 файлах — зелёные (раздел 6.2
PROJECT.md); issue [#52](https://github.com/michaelwelly/MuseonUrania/issues/52)
(SEO: sitemap.xml, robots.txt, canonical, OG) закрыт; issue
[#61](https://github.com/michaelwelly/MuseonUrania/issues/61) (иконка сайта)
закрыт. Протокол прогона #57: `robots.txt` — `Disallow: /` (стенд закрыт от
индексации по замыслу), `/icon.png` отдаётся, фотографии продукции — `200`
на всех запросах.

## 2. Админка и CRM

- Двадцать четыре маршрута админки: содержимое сайта (продукция, категории,
  новости, документы, журнал) и CRM (заявки, клиенты, сделки трёх воронок,
  КП, аналитика в четырёх разрезах).
- Сорок семь маршрутов и шестьдесят пять операций Admin API описаны
  отдельной спецификацией —
  [docs/api/vedal-admin-openapi.yaml](../api/vedal-admin-openapi.yaml).
- Учётные записи сотрудников и роли работают на стенде через Keycloak
  (issue [#43](https://github.com/michaelwelly/MuseonUrania/issues/43),
  закрыт).
- Публичной двери к CRM нет: клиентская база, суммы сделок и цены КП —
  закрытый контур, наружу не уходят, включая события Kafka (идентификатор,
  воронка, стадия — без имени клиента и суммы).
- Виджет «Разговоры» больше не перекрывает содержимое админки (issue
  [#49](https://github.com/michaelwelly/MuseonUrania/issues/49), закрыт).

**Подтверждение:** 166 файлов Java в портале, 56 тестовых классов и 364
теста на бэкенде — зелёные (раздел 6.1 PROJECT.md). Протокол прогона #57:
вход в админку — токен и роль `portal-admin` получены; полный цикл
«создан черновик → опубликован → появился в `/api/public/v1/news` → снят →
удалён» пройден без следов; виджет разговоров — круг 60×60 вместо таблетки,
перекрытие проверено.

## 3. Ассистент Ведалина

- Ответ формулирует YandexGPT поверх поиска по опубликованному материалу
  (`vedal.assistant.engine=yandexgpt`); ссылки под ответом даёт портал,
  а не модель.
- Разговор идёт потоком с признаком «печатает» (`/api/assistant/v1/chat`,
  `/stream`, `/typing`), обращение из чата заводит заявку с
  человекочитаемым номером, есть присутствие специалистов и часы работы
  поддержки, посетитель может оценить ответ (`/rating`).
- Ограничения — в `Guardrails` до вызова модели, а не в промпте: закрытые
  материалы физически недостижимы, потому что `LlmEngine` ходит только
  через `CatalogQuery`, `ContentQuery`, `DocumentQuery`, отдающие
  исключительно опубликованное. Нет источников — нет выдумки, есть
  передача человеку.
- Ассистент отвечает на языке вопроса и по существу сводит к сценариям
  (issue [#63](https://github.com/michaelwelly/MuseonUrania/issues/63),
  закрыт).

**Подтверждение:** протокол прогона #57: ответ по изделию со ссылками на
источники (`[3]`); без источников — вопрос уточняющий, без выдумки; вопрос
на английском о цене — ответ на английском по правилу «цены не публикуются,
оставьте заявку».

## 4. Инфраструктура и эксплуатация

- Ночная копия базы с проверкой восстановлением (issue
  [#41](https://github.com/michaelwelly/MuseonUrania/issues/41), закрыт) и
  копия вне машины — в отдельном бакете с ключом на запись (issue
  [#66](https://github.com/michaelwelly/MuseonUrania/issues/66), закрыт).
- Живость стенда проверяется каждые пять минут: место на диске, очередь
  писем (issue [#44](https://github.com/michaelwelly/MuseonUrania/issues/44),
  закрыт).
- Шлюз под Caddy передаёт порталу настоящий адрес посетителя, а не адрес
  прокси (issue [#58](https://github.com/michaelwelly/MuseonUrania/issues/58),
  закрыт).
- Открытый бакет `vedal-media` отдаёт фотографии, листинг бакета закрыт
  (issue [#55](https://github.com/michaelwelly/MuseonUrania/issues/55),
  закрыт).
- CI: три независимые проверки — Dependabot по версиям зависимостей,
  CodeQL по коду, Trivy внутрь образов (порог разнесён: HIGH виден в
  отчёте, CRITICAL с готовым исправлением роняет сборку) — раздел 7,
  пункт 14 PROJECT.md.

**Подтверждение:** протокол прогона #57 (журнал адреса посетителя,
фотографии `200`, листинг закрыт); документ
[docs/operations](../operations) описывает резервное копирование и
восстановление.

## 5. Безопасность и аудит

- Журнал аудита с фильтрами и цепочкой по `correlation_id`
  (`/api/admin/v1/audit`); обращение к закрытому документу пишется в
  журнал (`document.access.denied`).
- Роли читаются из Keycloak (`realm_access.roles`); локальные учётные
  записи — только запасной профиль `vedal.iam.mode=local`.
- Права роли приложения к базе урезаны миграцией `V15`: журнал защищён
  триггером `BEFORE TRUNCATE`, `UPDATE`/`DELETE`/`TRUNCATE` отозваны —
  раздел 7, пункт 17 PROJECT.md.
- Заявка принимается с `Idempotency-Key`, есть согласие на обработку
  персональных данных перед отправкой формы.

**Подтверждение:** протокол прогона #57: запрос закрытого документа —
`404` и запись `document.access.denied` в журнале; журнал пишет настоящий
адрес посетителя, а не адрес шлюза (issue #58).

---

## Остаточные работы, зависящие от заказчика

Помечены меткой `customer-blocked` — ждут материалов, доступов или решения
заказчика:

| Issue | Что | Почему ждём заказчика |
| --- | --- | --- |
| [#34](https://github.com/michaelwelly/MuseonUrania/issues/34) | Финальные фото и видео от подрядчика заказчика | материалы у подрядчика заказчика |
| [#35](https://github.com/michaelwelly/MuseonUrania/issues/35) | Финальные тексты, документы и разрешения на публикацию | тексты и разрешения на публикацию — за заказчиком |
| [#36](https://github.com/michaelwelly/MuseonUrania/issues/36) | Домен `vedal-med.ru` и HTTPS без изменения почты | управление доменом у заказчика |
| [#39](https://github.com/michaelwelly/MuseonUrania/issues/39) | 1С CRM handoff: способ обмена и ответственный | решение о способе обмена — за заказчиком |
| [#46](https://github.com/michaelwelly/MuseonUrania/issues/46) | SMTP: письма о заявках | нужен почтовый ящик для отправки |
| [#47](https://github.com/michaelwelly/MuseonUrania/issues/47) | Срок хранения заявок и автоочистка персональных данных | нужно решение заказчика о сроке хранения |
| [#53](https://github.com/michaelwelly/MuseonUrania/issues/53) | Яндекс Метрика и баннер согласия | нужен счётчик и текст согласия от заказчика |
| [#54](https://github.com/michaelwelly/MuseonUrania/issues/54) | Мультиязычность: английский и китайский | нужны согласованные тексты на этих языках |
| [#68](https://github.com/michaelwelly/MuseonUrania/issues/68) | КПП в реквизитах неверный | верное значение реквизита — у заказчика |
| [#69](https://github.com/michaelwelly/MuseonUrania/issues/69) | Кнопки соцсетей: адреса или убрать | адреса соцсетей — за заказчиком |
| [#72](https://github.com/michaelwelly/MuseonUrania/issues/72) | Продукция: убрать «уточняется» без замены выдумкой | нужны реальные характеристики от заказчика |
| [#75](https://github.com/michaelwelly/MuseonUrania/issues/75) | Каталог продукции одним PDF | материал для каталога — у заказчика |
| [#76](https://github.com/michaelwelly/MuseonUrania/issues/76) | Часы работы: 9:00–17:30 или автоответчик | нужно решение заказчика о режиме |
| [#77](https://github.com/michaelwelly/MuseonUrania/issues/77) | Сотрудники на контактах: почты и телефоны | контакты сотрудников — у заказчика |

## Остаточные работы на нашей стороне

- **Фронтенд, точечные правки:** [#67](https://github.com/michaelwelly/MuseonUrania/issues/67)
  (членство в УТПП), [#70](https://github.com/michaelwelly/MuseonUrania/issues/70)
  (картинка продукции не подгоняется под экран), [#71](https://github.com/michaelwelly/MuseonUrania/issues/71)
  (подпись и картинка в виджете Ведалины), [#73](https://github.com/michaelwelly/MuseonUrania/issues/73)
  (кнопки документов на реальные файлы), [#74](https://github.com/michaelwelly/MuseonUrania/issues/74)
  (карта на контактах), [#78](https://github.com/michaelwelly/MuseonUrania/issues/78)
  (подвал: убрать «Реанимация» из «Оборудования»), [#79](https://github.com/michaelwelly/MuseonUrania/issues/79)
  (знак в админке должен вести на сайт), [#62](https://github.com/michaelwelly/MuseonUrania/issues/62)
  (вёрстка на Mac: собрать доказательства и починить).
- **Ассистент и CRM:** [#48](https://github.com/michaelwelly/MuseonUrania/issues/48)
  (авторизованная Ведалина: поиск по внутренним документам),
  [#38](https://github.com/michaelwelly/MuseonUrania/issues/38) (RAG/pgvector
  после корпуса документов), [#50](https://github.com/michaelwelly/MuseonUrania/issues/50)
  (ответ посетителю прямо из виджета разговоров), [#51](https://github.com/michaelwelly/MuseonUrania/issues/51)
  (дежурство: кто сегодня на линии).
- **Инфраструктура и эксплуатация:** [#37](https://github.com/michaelwelly/MuseonUrania/issues/37)
  (финальная загрузка материалов в объектное хранилище и проверка доступа),
  [#42](https://github.com/michaelwelly/MuseonUrania/issues/42) (MFA в
  Keycloak и решение по доступу к `/admin`), [#45](https://github.com/michaelwelly/MuseonUrania/issues/45)
  (переезд в прод-контур), [#60](https://github.com/michaelwelly/MuseonUrania/issues/60)
  (очередь Dependabot и PR #17), [#65](https://github.com/michaelwelly/MuseonUrania/issues/65)
  (защита от DDoS на одной ВМ с чужим сайтом).

---

## Важно

Остаточные работы, перечисленные в двух разделах выше, **не входят** в
выполненный объём, зафиксированный в разделах 1–5 настоящего реестра, и
**не влияют** на его состав.
