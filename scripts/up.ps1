# Поднять весь VEDAL Portal на чистой машине с Windows. Нужен только Docker.
#
#   git clone <репозиторий>
#   cd MuseonUrania
#   .\scripts\up.ps1
#
# То же, что scripts/up.sh, но без необходимости ставить bash. Первый запуск
# собирает образы и занимает около десяти минут; дальше — секунды.
#
# Скрипт идемпотентен: повторный запуск не ломает уже поднятое и не
# перезаписывает .env.

$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")
$composeFile = "backend/compose.yaml"
$envFile = "backend/.env"

function Say([string]$text) { Write-Host $text -ForegroundColor Cyan }
function Fail([string]$text) { Write-Host $text -ForegroundColor Red; exit 1 }

# ————— проверки —————

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Fail "Docker не найден. Поставьте Docker Desktop: https://docs.docker.com/get-docker/"
}

docker info *> $null
if (-not $?) { Fail "Docker установлен, но не запущен. Запустите Docker Desktop и повторите." }

docker compose version *> $null
if (-not $?) { Fail "Нужен Docker Compose v2 (команда 'docker compose'). Обновите Docker Desktop." }

# ————— секреты —————

# Пароли генерируются на месте и остаются в backend/.env, который
# не коммитится. Одинаковые пароли на всех машинах — это не «удобно
# для разработки», это пароль, который однажды уедет на сервер.
function Random-Secret {
  $bytes = [byte[]]::new(18)
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  [Convert]::ToBase64String($bytes) -replace '[^A-Za-z0-9]', ''
}

if (Test-Path $envFile) {
  Say "backend/.env уже есть — оставляю как есть"
} elseif ((docker volume ls --format '{{.Name}}') -contains 'backend_vedal-db') {
  # Тома с этой машины остались от запуска без .env — то есть база
  # инициализирована паролем по умолчанию. Сгенерировать новый значит
  # получить портал, который не может подключиться, и полчаса на выяснение
  # почему. Пароль в инициализированном томе меняется в самой базе,
  # а не в compose.
  Say "Тома уже созданы: пишу backend/.env со значениями по умолчанию,"
  Say "иначе новые пароли не подойдут к инициализированной базе."
  Say "Нужны свои пароли — сотрите тома: docker compose -f $composeFile --profile app down -v"

  $lines = @(
    "# Сгенерировано scripts/up.ps1 поверх существующих томов."
    "# Значения по умолчанию, как в compose.yaml."
    "VEDAL_DB_NAME=vedal"
    "VEDAL_DB_USER=vedal"
    "VEDAL_DB_PASSWORD=vedal"
    "VEDAL_S3_ACCESS_KEY=vedal"
    "VEDAL_S3_SECRET_KEY=vedal-local-secret"
    "VEDAL_KEYCLOAK_ADMIN=admin"
    "VEDAL_KEYCLOAK_ADMIN_PASSWORD=admin-local"
  )
  # utf8 без BOM: docker compose спотыкается о BOM в первой строке .env.
  [System.IO.File]::WriteAllLines((Join-Path (Get-Location) "backend\.env"), $lines)
} else {
  Say "Первый запуск: генерирую backend/.env с новыми паролями"

  $lines = @(
    "# Сгенерировано scripts/up.ps1. В репозиторий не попадает."
    "VEDAL_DB_NAME=vedal"
    "VEDAL_DB_USER=vedal"
    "VEDAL_DB_PASSWORD=$(Random-Secret)"
    "VEDAL_S3_ACCESS_KEY=vedal"
    "VEDAL_S3_SECRET_KEY=$(Random-Secret)"
    "VEDAL_KEYCLOAK_ADMIN=admin"
    "VEDAL_KEYCLOAK_ADMIN_PASSWORD=$(Random-Secret)"
  )
  [System.IO.File]::WriteAllLines((Join-Path (Get-Location) "backend\.env"), $lines)
}

# ————— запуск —————

Say "Собираю образы и поднимаю стек. Первый раз это долго."
docker compose -f $composeFile --profile app up -d --build
if (-not $?) { Fail "Сборка не прошла. Вывод выше." }

# ————— ожидание —————
#
# `up -d` возвращается, когда контейнеры созданы, а не когда приложение
# ответило. Сайт собирает страницы при старте, поэтому ждём именно его.

Say "Жду готовности. Сайт собирается при первом старте, это ещё пара минут."
$deadline = (Get-Date).AddMinutes(15)
while ($true) {
  $state = docker inspect --format '{{.State.Health.Status}}' vedal-site 2>$null
  if ($state -eq "healthy") { break }
  if ($state -eq "unhealthy") {
    docker compose -f $composeFile logs --tail 40 site
    Fail "Сайт не поднялся. Полный вывод: docker compose -f $composeFile logs site"
  }
  if ((Get-Date) -gt $deadline) {
    Fail "Не дождался за 15 минут. Смотрите: docker compose -f $composeFile ps"
  }
  Start-Sleep -Seconds 5
}

# ————— что дальше —————

$settings = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^([A-Z_]+)=(.*)$') { $settings[$Matches[1]] = $Matches[2] }
}
$gateway = if ($settings.VEDAL_GATEWAY_PORT) { $settings.VEDAL_GATEWAY_PORT } else { "8080" }
$keycloak = if ($settings.VEDAL_KEYCLOAK_PORT) { $settings.VEDAL_KEYCLOAK_PORT } else { "8180" }

Write-Host ""
Say "Готово."
Write-Host ""
Write-Host "  Сайт и API      http://localhost:$gateway"
Write-Host "  Админка         http://localhost:$gateway/admin/"
Write-Host "  Спецификация    http://localhost:$gateway/swagger-ui.html"
Write-Host "  Keycloak        http://localhost:$keycloak"
Write-Host ""
Write-Host "  Вход в админку: editor / editor-local"
Write-Host "  (учётная запись локального стека, заведена импортом realm'а —"
Write-Host "   см. backend/keycloak/README.md)"
Write-Host ""
Write-Host "  Пароли базы, хранилища и консоли Keycloak — в backend/.env."
Write-Host ""
Write-Host "  Остановить:   docker compose -f $composeFile --profile app down"
Write-Host "  Логи портала: docker compose -f $composeFile logs -f portal"
Write-Host "  Состояние:    docker compose -f $composeFile ps"
Write-Host ""
