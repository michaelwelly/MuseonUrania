# VEDAL VM deploy plan, 2026-08-18

## 1. Цель

Развернуть проект VEDAL на той же ВМ, где сейчас живет `c3ag`, но разнести проекты по отдельным каталогам, Docker Compose project names, сетям, volume и nginx-host routing.

Основной принцип: `c3ag` и VEDAL не должны делить контейнеры приложения, переменные окружения, базы, Kafka topics и публичные upstream-порты.

## 2. Карта хостов и маршрутизации

Файл на ВМ: `/opt/infra/HOSTS.md`.

| Хост | Назначение | Внешний вход | Внутренний upstream | Статус |
| --- | --- | --- | --- | --- |
| `c3ag.ru` | текущий проект C3AG | `https://c3ag.ru` | существующий frontend/API проекта C3AG | не трогать без аудита |
| `www.c3ag.ru` | www-алиас C3AG | `https://www.c3ag.ru` | redirect или тот же upstream | не трогать без аудита |
| `vedal-med.ru` | публичный сайт VEDAL | `https://vedal-med.ru` | `vedal-gateway` / `vedal-site` | подключить после DNS-доступа |
| `www.vedal-med.ru` | www-алиас VEDAL | `https://www.vedal-med.ru` | redirect на `vedal-med.ru` | подключить после DNS-доступа |
| `admin.vedal-med.ru` | закрытая админка | `https://admin.vedal-med.ru` | admin/backend gateway | публиковать только с auth/VPN/WAF |
| `api.vedal-med.ru` | внешний API, если понадобится | `https://api.vedal-med.ru` | backend API | по умолчанию не открывать |

До переключения боевого домена можно поднять временный host на текущем домене или техническом subdomain, например `vedal.c3ag.ru`, если DNS позволяет.

## 3. Размещение на ВМ

Рекомендуемая структура:

| Путь | Что хранит |
| --- | --- |
| `/opt/infra` | общий reverse proxy, certbot/acme, файл `HOSTS.md`, правила маршрутизации |
| `/opt/c3ag` или текущий путь проекта | существующий проект C3AG |
| `/opt/vedal-portal` | репозиторий `michaelwelly/MuseonUrania` |
| `/opt/vedal-portal/.env.production` | production env, не коммитить |
| `/var/log/vedal-deploy.log` | журнал деплоев |

Compose names:

| Проект | Compose project name |
| --- | --- |
| C3AG | `c3ag` или фактическое текущее имя |
| VEDAL | `vedal` |

## 4. Инфраструктура VEDAL на первом деплое

На этом этапе используем VM + Docker Compose:

| Компонент | Решение на первом этапе |
| --- | --- |
| Frontend/public site | Docker container |
| Backend/CMS/API | Docker container |
| PostgreSQL | container в Docker, отдельный volume |
| Kafka/queue | container в Docker, отдельный volume/topics |
| S3-compatible storage | Yandex Object Storage, bucket `vedal-media` для медиа и `vedal-documents` для документов |
| Reverse proxy | общий nginx/caddy на VM |
| HTTPS | Let's Encrypt через общий reverse proxy |
| Метрика | добавить на публичный frontend после доменного подключения |

Важно: PostgreSQL и Kafka в презентации и плане обозначаем как контейнеры в Docker, не как управляемые облачные сервисы.

MinIO в стенд-продакшне не используем. Если локальный MinIO был поднят старым compose, deploy-скрипт удаляет контейнеры `vedal-minio` и `vedal-minio-init`.

## 5. CI/CD, чтобы Миша и Егор не мешали друг другу

### Рекомендуемый MVP-процесс

1. Все изменения идут через GitHub branches и PR.
2. Deploy выполняется только с `main` или согласованного release branch.
3. На ВМ лежит `scripts/deploy.sh`, который берет lock:
   - `flock /var/lock/vedal-deploy.lock`
   - пишет лог в `/var/log/vedal-deploy.log`
   - делает `git fetch`
   - переключается на нужный commit/branch
   - выполняет `docker compose -p vedal ... up -d --build`
   - запускает health checks.
4. Если Миша и Егор одновременно запускают деплой, второй ждет lock или получает понятное сообщение.

### Следующий уровень

GitHub Actions:

1. build/test на PR;
2. build Docker images после merge в `main`;
3. push images в GHCR;
4. deploy по SSH на ВМ командой `docker compose pull && docker compose up -d`.

Для старта быстрее поднять ручной SSH deploy script, а GitHub Actions добавить после стабилизации compose.

## 6. SSH-доступ

Добавить ключ Егора в `/home/ubuntu/.ssh/authorized_keys`:

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIK1eu3K6B6yfn3gwGo29zTM6xDzo/+V8WvnlDA2lj3j3 asura@DESKTOP-OTGUHVS
```

Правило: доступ дает право деплоить через скрипт, но не править руками production env и nginx без согласования.

Фактическая проверка на ВМ:

- ключ Егора уже добавлен;
- `sshd` слушает `0.0.0.0:2222`;
- `ufw` inactive;
- `iptables INPUT` accept;
- SSH Михаила на `2222` работает.

Если у Егора `connection timeout`, это означает внешний сетевой блок, а не
ошибку ключа. Нужно в Yandex Cloud Security Group добавить входящее правило:

| Поле | Значение |
| --- | --- |
| Direction | Ingress |
| Protocol | TCP |
| Port | `2222` |
| Source | `<публичный IP Егора>/32` |
| Description | `Egor SSH deploy access` |

Порт `22` не используем. `0.0.0.0/0` для SSH не включать на постоянной основе:
если нужно срочно, открывать временно и закрывать после проверки.

## 7. Backend / deploy задачи, Миша

1. Провести аудит ВМ: текущие контейнеры, nginx, certbot, открытые порты, путь проекта C3AG.
2. Добавить SSH-ключ Егора.
3. Создать `/opt/infra/HOSTS.md`.
4. Создать `/opt/vedal-portal` и подготовить clone/pull репозитория.
5. Исправить production compose: отдельные сети, volumes, project name `vedal`, отсутствие конфликтов портов с C3AG.
6. Проверить init-скрипты PostgreSQL, особенно права запуска shell-файлов.
7. Поднять backend, PostgreSQL, Kafka, storage, frontend.
8. Настроить reverse proxy для технического host.
9. Подключить HTTPS.
10. Проверить Yandex GPT API smoke-тестом для ассистента Ведалина.
11. Подготовить RAG pipeline: public/internal/confidential, chunks, embeddings, pgvector.
12. Описать варианты интеграции с 1С CRM: webhook, REST API, файл/почта как fallback.

## 8. Frontend задачи, Егор

1. Принять frontend architecture/components от Миши.
2. Внести customer-request правки по страницам:
   - `about`;
   - `products`;
   - карточки 4 продуктов;
   - `production`;
   - `documents`;
   - `news`;
   - `contacts`.
3. Переименовать Уранию в Ведалину во всем публичном UI.
4. Убрать/переименовать блоки согласно `outputs/customer_presentation/vedal_customer_requests_plan_2026-08-18.md`.
5. Проверить адаптив desktop/mobile.
6. Проверить формы, CTA, пустые состояния и ошибки.
7. Подготовить PR, не деплоить напрямую без согласования.

## 9. Архитектурные решения после первого деплоя

Разобрать отдельно:

1. IAM: роли, сотрудники, права на документы, доступ к закрытому AI-поиску.
2. 1С CRM: точный способ интеграции и владелец API со стороны заказчика.
3. Политика публичности Object Storage: `vedal-media` можно открыть только на чтение или оставить приватным с CDN/signed URLs, `vedal-documents` остается приватным.
4. Как хранить персональные данные и логи на территории РФ.
5. Как отделять public assistant от закрытого assistant после логина.

## 10. Фактический первый деплой, 2026-08-18

ВМ:

| Параметр | Значение |
| --- | --- |
| VM | `smart_soultion_mvp` |
| External IP | `51.250.31.97` |
| SSH | `ubuntu@51.250.31.97:2222` |
| Репозиторий на ВМ | `/opt/vedal-portal` |
| Deployed commit | `42d74d3` |
| Compose project | `vedal` |
| Compose files | `backend/compose.yaml`, `backend/compose.host.yaml`, `backend/compose.stand-prod.yaml` |
| Stand-prod public URL | `http://51.250.31.97:18080` |
| Object Storage media bucket | `vedal-media` |
| Object Storage documents bucket | `vedal-documents` |

`vedal-media` используется для публичных ассетов сайта. Bucket целиком не открывали, но загруженным объектам сайта выставлен `public-read`. `vedal-documents` остается приватным для внутренней и согласуемой документации.

Контейнеры VEDAL подняты в лабораторном host-режиме, чтобы не мешать C3AG:

| Сервис | Доступность |
| --- | --- |
| `vedal-gateway` | `0.0.0.0:18080 -> 8080`, healthy |
| `vedal-keycloak` | `127.0.0.1:18180 -> 8080`, healthy |
| `vedal-site` | только внутри docker network, healthy |
| `vedal-portal` | только внутри docker network, healthy |
| `vedal-db` | только внутри docker network, healthy |
| `vedal-kafka` | только внутри docker network, healthy |
| `vedal-minio` | не используется в стенд-продакшне, удален |
| `vedal-connect` | только внутри docker network, healthy |

Проверенные страницы через gateway:

```text
200 /
200 /about/
200 /products/
200 /service/
200 /production/
200 /documents/
200 /news/
200 /contacts/
302 /swagger-ui.html
```

Как открыть стенд-продакшн для заказчика:

```text
http://51.250.31.97:18080
```

Как открыть закрытые сервисы с локальной машины:

```bash
ssh -N \
  -L 8080:127.0.0.1:18080 \
  -L 8180:127.0.0.1:18180 \
  -p 2222 \
  -i /Users/michaelwelly/.ssh/astor_yandex_vm_ed25519 \
  ubuntu@51.250.31.97
```

После этого:

| Локальный адрес | Что |
| --- | --- |
| `http://localhost:8080` | сайт и API |
| `http://localhost:8080/admin/` | админка |
| `http://localhost:8080/swagger-ui.html` | Swagger |
| `http://localhost:8180` | Keycloak |

Deploy-команда для Миши:

```bash
ssh -p 2222 \
  -i /Users/michaelwelly/.ssh/astor_yandex_vm_ed25519 \
  ubuntu@51.250.31.97 \
  '/opt/vedal-portal/scripts/deploy-stand-prod.sh main'
```

Deploy-команда для Егора:

```bash
ssh -p 2222 ubuntu@51.250.31.97 '/opt/vedal-portal/scripts/deploy-stand-prod.sh main'
```

В deploy-скрипте есть lock: если один деплой уже идет, второй не начнется параллельно.

Что еще не сделано:

1. Публичная маршрутизация `vedal-med.ru` не переключалась: нужен доступ к DNS/регистратору и решение, каким proxy держим 80/443 рядом с текущим `astor_api_gateway`.
2. HTTPS для VEDAL-домена не включался, потому что домен еще не направлен на этот host. До этого стенд-продакшн показываем по IP.
3. 1С CRM пока зафиксирована как будущая интеграция, без живого API.
4. Yandex GPT/RAG еще не подключались к стенду: нужен список разрешенных документов и ключи/квоты.
5. Для следующих медиа-загрузок нужно закрепить правило: публичные изображения сайта получают object-level `public-read`, закрытые документы уходят только в `vedal-documents`.
