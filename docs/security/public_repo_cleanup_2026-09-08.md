# Public Repository Cleanup — 2026-09-08

**Русский** · English version is intentionally omitted for now: this file is an
operational security note for the repository owner.

Цель проверки — оставить `michaelwelly/MuseonUrania` открытым как портфолио и не
публиковать договоры, доступы, коммерческие условия, персональные данные и
клиентские исходники.

## Что убрано из текущего индекса Git

Файлы остаются на локальном диске, но удалены из отслеживания через
`git rm --cached`:

| Путь | Почему убрано |
| --- | --- |
| `outputs/` | презентации, PDF, рендеры, скрипты разовой подготовки, клиентские артефакты |
| `docs/commercial/` | оценки, роли, коммерческий план, данные для договора |
| `docs/communications/` | черновики писем, подписи, персональные контакты |
| `docs/requests/` | рабочая переписка и запросы материалов заказчику |
| `docs/products/*.pdf` | клиентские датащиты и исходные продуктовые PDF |
| `docs/operations/credentials_handover*.md` | документы передачи доступов |
| `prototypes/urania-web-interface.html` | устаревший прототип с прежним именем ассистента |

## Что добавлено в `.gitignore`

- `outputs/`;
- `docs/commercial/`;
- `docs/communications/`;
- `docs/requests/`;
- `docs/products/*.pdf`;
- `docs/operations/credentials_handover*.md`;
- `prototypes/urania-web-interface.html`.

## Что остаётся в репозитории осознанно

| Путь | Комментарий |
| --- | --- |
| `backend/.env.example`, `backend/.env.host.example`, `frontend/.env.example` | шаблоны переменных без боевых значений |
| `backend/keycloak/vedal-realm.json` | локальный demo-realm для запуска разработчика; не использовать на стенде/проде |
| `backend/keycloak/stand/vedal-realm.json`, `backend/keycloak/prod/vedal-realm.json` | realm-шаблоны с подстановкой секретов из окружения |
| `docs/api/vedal.postman_collection.json` | коллекция API; пароль очищен, токен пользователь получает локально |
| `frontend/public/photos/**`, `frontend/public/brand/**` | публичные изображения сайта, не документы доступа |
| `assets/brand/**`, `assets/vedalina/**` | брендовые ассеты и визуалы для портфолио |

## Что найдено в истории Git

Даже после чистки текущего состояния в истории уже встречались приватные
категории:

- черновики договора, счёта, приложения и акта передачи доступов в
  `outputs/contracts/`;
- HTML-подпись, тестовые письма и лого для email в `outputs/email/`;
- коммерческие планы и оценки в `docs/commercial/`;
- письма/коммуникации в `docs/communications/`;
- запросы материалов заказчику в `docs/requests/`;
- продуктовые PDF в `docs/products/`.

Обычный коммит не удалит эти данные из старых коммитов GitHub. Для настоящего
публичного режима нужен один из двух вариантов:

1. Переписать историю через `git filter-repo`/BFG и force-push всех веток и
   тегов.
2. Создать новый чистый публичный mirror-репозиторий только из текущего
   очищенного дерева.

До выполнения одного из этих вариантов репозиторий лучше не считать полностью
очищенным для публичного портфолио.

## Официальный пакет вне репозитория

Документы для подписи и передачи собраны отдельно:

`/Users/michaelwelly/Documents/VEDAL_Official_Handover_2026-09-08`

Внутри:

- `01_contract/` — подписанный договор;
- `02_acts/` — акты;
- `03_registry/` — приложение/реестр к акту;
- `04_audit/` — аудит сдачи;
- `05_rendered_pdf/` — PDF-версии для отправки.

## Проверки перед публикацией

Перед переводом репозитория в окончательно публичный режим:

```bash
git status --short
git ls-files | rg -i '(^outputs/|^docs/(commercial|communications|requests)/|credentials_handover|договор|акт|счет|invoice|signature|\\.env$)'
rg -n -i --hidden --glob '!backend/.env' --glob '!node_modules/**' --glob '!target/**' '(api-key|bearer|password|secret|access_key|secret_key|token|wp-login|mail\\.nic\\.ru)'
```

Если первая команда после `git ls-files` что-то показывает, файл нужно либо
удалить из индекса, либо осознанно оставить с объяснением.
