#!/usr/bin/env bash
#
# Поднять весь VEDAL Portal на чистой машине. Нужен только Docker.
#
#   git clone <репозиторий> && cd MuseonUrania && ./scripts/up.sh
#
# Первый запуск собирает образы и занимает около десяти минут: Maven тянет
# зависимости, Next собирает страницы. Дальше — секунды, слои кэшируются.
#
# Скрипт идемпотентен: повторный запуск не ломает уже поднятое и не
# перезаписывает .env.

set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE_FILE="backend/compose.yaml"
ENV_FILE="backend/.env"

say() { printf '\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

# ————— проверки —————

command -v docker >/dev/null 2>&1 || fail \
  "Docker не найден. Поставьте Docker Desktop (Windows, macOS) или Docker Engine (Linux): https://docs.docker.com/get-docker/"

docker info >/dev/null 2>&1 || fail \
  "Docker установлен, но не запущен. Запустите Docker Desktop и повторите."

docker compose version >/dev/null 2>&1 || fail \
  "Нужен Docker Compose v2 (команда 'docker compose', без дефиса). Обновите Docker."

# ————— секреты —————

# Пароли генерируются на месте и остаются в backend/.env, который не
# коммитится. Одинаковые пароли на всех машинах — это не «удобно
# для разработки», это пароль, который однажды уедет на сервер.
if [ -f "$ENV_FILE" ]; then
  say "backend/.env уже есть — оставляю как есть"
elif docker volume ls --format '{{.Name}}' | grep -q '^backend_vedal-db$'; then
  # Тома с этой машины остались от запуска без .env — то есть база
  # инициализирована паролем по умолчанию. Сгенерировать новый значит
  # получить портал, который не может подключиться, и полчаса на выяснение
  # почему. Пароль в инициализированном томе меняется в самой базе, а не
  # в compose.
  say "Тома уже созданы: пишу backend/.env со значениями по умолчанию,"
  say "иначе новые пароли не подойдут к инициализированной базе."
  say "Нужны свои пароли — сотрите тома: docker compose -f $COMPOSE_FILE --profile app down -v"

  {
    echo "# Сгенерировано scripts/up.sh поверх существующих томов."
    echo "# Значения по умолчанию, как в compose.yaml."
    echo "VEDAL_DB_NAME=vedal"
    echo "VEDAL_DB_USER=vedal"
    echo "VEDAL_DB_PASSWORD=vedal"
    echo "VEDAL_S3_ACCESS_KEY=vedal"
    echo "VEDAL_S3_SECRET_KEY=vedal-local-secret"
    echo "VEDAL_KEYCLOAK_ADMIN=admin"
    echo "VEDAL_KEYCLOAK_ADMIN_PASSWORD=admin-local"
  } > "$ENV_FILE"
else
  say "Первый запуск: генерирую backend/.env с новыми паролями"

  random() { LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 24; }

  {
    echo "# Сгенерировано scripts/up.sh. В репозиторий не попадает."
    echo "VEDAL_DB_NAME=vedal"
    echo "VEDAL_DB_USER=vedal"
    echo "VEDAL_DB_PASSWORD=$(random)"
    echo "VEDAL_S3_ACCESS_KEY=vedal"
    echo "VEDAL_S3_SECRET_KEY=$(random)"
    echo "VEDAL_KEYCLOAK_ADMIN=admin"
    echo "VEDAL_KEYCLOAK_ADMIN_PASSWORD=$(random)"
  } > "$ENV_FILE"
fi

# ————— запуск —————

say "Собираю образы и поднимаю стек. Первый раз это долго."
docker compose -f "$COMPOSE_FILE" --profile app up -d --build

# ————— ожидание —————
#
# `up -d` возвращается, когда контейнеры созданы, а не когда приложение
# ответило. Сайт собирает страницы при старте, поэтому ждём именно его.

say "Жду готовности. Сайт собирается при первом старте, это ещё пара минут."
deadline=$(( $(date +%s) + 900 ))
while :; do
  state=$(docker inspect --format '{{.State.Health.Status}}' vedal-site 2>/dev/null || echo "нет контейнера")
  case "$state" in
    healthy) break ;;
    unhealthy)
      docker compose -f "$COMPOSE_FILE" logs --tail 40 site
      fail "Сайт не поднялся. Полный вывод: docker compose -f $COMPOSE_FILE logs site"
      ;;
  esac
  [ "$(date +%s)" -lt "$deadline" ] || fail \
    "Не дождался за 15 минут. Смотрите: docker compose -f $COMPOSE_FILE ps"
  sleep 5
done

# ————— что дальше —————

gateway_port=$(grep -E '^VEDAL_GATEWAY_PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 || true)
keycloak_port=$(grep -E '^VEDAL_KEYCLOAK_PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 || true)
gateway_port=${gateway_port:-8080}
keycloak_port=${keycloak_port:-8180}

cat <<INFO

$(say "Готово.")

  Сайт и API      http://localhost:${gateway_port}
  Админка         http://localhost:${gateway_port}/admin/
  Спецификация    http://localhost:${gateway_port}/swagger-ui.html
  Keycloak        http://localhost:${keycloak_port}

  Вход в админку: editor / editor-local
  (учётная запись локального стека, заведена импортом realm'а —
   см. backend/keycloak/README.md)

  Пароли базы, хранилища и консоли Keycloak — в backend/.env.

  Остановить:      docker compose -f ${COMPOSE_FILE} --profile app down
  Логи портала:    docker compose -f ${COMPOSE_FILE} logs -f portal
  Состояние:       docker compose -f ${COMPOSE_FILE} ps

INFO
