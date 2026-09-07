#!/usr/bin/env bash
# Проверка живости стенда изнутри машины.
#
# Изнутри — намеренно, и это главное решение здесь. Снаружи ответ портала
# смешан с состоянием канала: 7 сентября один и тот же адрес отвечал
# и не отвечал с интервалом в минуту, при том что стек был здоров и по
# 127.0.0.1 отдавал страницы за шесть миллисекунд. Проверка, ходящая
# снаружи, будила бы по ночам из-за чужого маршрутизатора.
#
# Что проверяется: живость портала, отдаётся ли главная, состояние
# контейнеров, место на диске и очередь писем. Всё, что ломается тихо
# и обнаруживается по жалобе.
#
# Оповещение — в журнал всегда, наружу — если задан VEDAL_ALERT_WEBHOOK.
# Без него скрипт всё равно полезен: `journalctl -u vedal-health` показывает
# историю, а состояние хранится в файле и меняется только при смене.

set -uo pipefail

GATEWAY="${VEDAL_HEALTH_URL:-http://127.0.0.1:18080}"
STATE="${VEDAL_HEALTH_STATE:-/var/lib/vedal/health.state}"
DISK_LIMIT="${VEDAL_HEALTH_DISK_PERCENT:-85}"
QUEUE_LIMIT="${VEDAL_HEALTH_QUEUE:-50}"
DB_CONTAINER="${VEDAL_DB_CONTAINER:-vedal-db}"
DB_NAME="${VEDAL_DB_NAME:-vedal}"
DB_USER="${VEDAL_DB_USER:-vedal}"

problems=()

# ————— портал —————
health=$(curl -fsS -m 10 "$GATEWAY/actuator/health" 2>/dev/null)
case "$health" in
    *'"status":"UP"'*) ;;
    "") problems+=("портал не ответил на /actuator/health") ;;
    *)  problems+=("портал отвечает не UP: ${health:0:120}") ;;
esac

code=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$GATEWAY/" 2>/dev/null)
[ "$code" = "200" ] || problems+=("главная отдаёт $code вместо 200")

# ————— контейнеры —————
#
# Проверяются только свои: на этой машине живёт ещё и чужой сайт, и его
# состояние — не наше дело.
while read -r name status; do
    case "$status" in
        Up*healthy*|Up*) ;;
        *) problems+=("контейнер $name: $status") ;;
    esac
done < <(docker ps -a --filter 'name=vedal-' --format '{{.Names}} {{.Status}}' 2>/dev/null \
    | grep -v 'vedal-media-seed\|vedal-connect-init\|vedal_restore')

for want in vedal-portal vedal-gateway vedal-site vedal-db; do
    docker ps --filter "name=$want" --format '{{.Names}}' 2>/dev/null | grep -qx "$want" \
        || problems+=("контейнер $want не запущен")
done

# ————— диск —————
#
# Место кончается медленно и незаметно, а выглядит потом как отказ
# приложения: Postgres перестаёт писать, docker не может собрать образ.
# Предпоследнее поле, а не пятое: в имени файловой системы бывает пробел,
# и тогда колонки съезжают — ловится ровно так, «диск занят на 50270196%».
used=$(df -P / | awk 'END {gsub(/%/,"",$(NF-1)); print $(NF-1)}')
[ "${used:-0}" -lt "$DISK_LIMIT" ] || problems+=("диск занят на ${used}% (предел ${DISK_LIMIT}%)")

# ————— очередь писем —————
#
# failed — письмо, которое не ушло после всех попыток: его разбирают руками,
# и об этом надо знать. Большая очередь queued означает, что отправка стоит.
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$DB_CONTAINER"; then
    counts=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
        "select coalesce(sum((status='failed')::int),0) || ' ' || coalesce(sum((status='queued')::int),0) from outbound_mail" 2>/dev/null)
    failed=${counts%% *}
    queued=${counts##* }
    [ "${failed:-0}" -eq 0 ] || problems+=("писем в разборе руками: $failed")
    [ "${queued:-0}" -lt "$QUEUE_LIMIT" ] || problems+=("писем ждёт отправки: $queued")
fi

# ————— итог —————
#
# Состояние на диске нужно, чтобы не повторять одно и то же каждые пять
# минут: тревога поднимается на переходе, а не на каждом тике. Иначе
# оповещения превращаются в фон, который перестают читать.
mkdir -p "$(dirname "$STATE")" 2>/dev/null
was=$(cat "$STATE" 2>/dev/null || echo ok)

if [ ${#problems[@]} -eq 0 ]; then
    echo ok > "$STATE"
    if [ "$was" != "ok" ]; then
        echo "ВОССТАНОВИЛОСЬ: всё в порядке"
        [ -n "${VEDAL_ALERT_WEBHOOK:-}" ] && curl -fsS -m 10 -X POST "$VEDAL_ALERT_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d '{"text":"VEDAL: стенд восстановился"}' > /dev/null 2>&1
    else
        echo "всё в порядке"
    fi
    exit 0
fi

text="VEDAL: $(printf '%s; ' "${problems[@]}")"
echo "ТРЕВОГА: $text"
echo fail > "$STATE"

if [ "$was" = "ok" ] && [ -n "${VEDAL_ALERT_WEBHOOK:-}" ]; then
    # Тело собирается python-безопасно: кавычки в тексте проблемы сломали бы
    # JSON. jq в образе может не быть, поэтому экранируем sed'ом — набор
    # символов здесь наш собственный, из строк выше.
    safe=$(printf '%s' "$text" | sed 's/\\/\\\\/g; s/"/\\"/g')
    curl -fsS -m 10 -X POST "$VEDAL_ALERT_WEBHOOK" \
        -H 'Content-Type: application/json' \
        -d "{\"text\":\"$safe\"}" > /dev/null 2>&1
fi

exit 1
