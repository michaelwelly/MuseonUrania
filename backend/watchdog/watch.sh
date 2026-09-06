#!/bin/sh
# Сторож развёрнутой среды.
#
# Он делает две вещи, и вторая важнее первой.
#
# 1. Говорит, когда что-то отвалилось: письмо на почту при смене состояния,
#    а не при каждой неудачной проверке.
# 2. Ведёт запись. Раз в минуту в журнал уходит строка с памятью, диском
#    и состоянием служб. Именно её не хватало, когда стенд начал падать:
#    было видно, что он лежит, и нечем было ответить почему.
#
# Чего он НЕ умеет — и это надо знать, а не выяснять в день аварии. Сторож
# живёт на той же машине, что и всё остальное. Кончится память — система
# прибьёт и его; выключится машина — молчание будет полным и неотличимым
# от тишины «всё хорошо». Отсюда правило: молчание сторожа не является
# доказательством работоспособности. Чтобы заметить смерть самой машины,
# нужен наблюдатель снаружи, и он в этот файл не помещается.
#
# Почему не Prometheus с Grafana. Они дают графики и историю в базе,
# и на парке машин это окупается. Здесь машина одна, и на ней уже мало
# памяти — настолько, что это подозреваемый номер один в падениях стенда.
# Ставить рядом ещё гигабайт наблюдателя значит лечить голод едоком.
# Этот сторож занимает несколько мегабайт, а его история — те же строки
# журнала docker, которые и так пишутся с ротацией.

set -u

: "${CHECK_EVERY:=60}"        # секунд между проверками
: "${FAILS_TO_ALARM:=3}"      # сколько неудач подряд считаются аварией
: "${REMIND_HOURS:=6}"        # как часто напоминать, пока не починили
: "${DISK_FREE_MIN:=10}"      # процентов свободного места, ниже — авария
: "${MEM_FREE_MIN:=10}"       # процентов доступной памяти, ниже — авария
: "${DISK_PATH:=/}"

# Что проверять. Список через пробел, каждый элемент — имя|адрес|запрещённое.
# Третье поле необязательно: это подстрока, которой в ответе быть не должно.
# Она нужна тем, кто отвечает 200 и при этом сообщает о поломке — например
# Kafka Connect, у которого упавший коннектор виден только в теле ответа.
: "${TARGETS:=}"

# Почта. Пусто — сторож только пишет в журнал и говорит об этом вслух.
#
# Переменные те же, что у портала: SPRING_MAIL_* из backend/.env. Ящик один,
# и заводить ему второе имя значило бы завести второй источник правды —
# который однажды разойдётся с первым, и выяснится это в день, когда тревога
# не доедет.
: "${SMTP_HOST:=}"
: "${SMTP_PORT:=465}"
: "${SMTP_USER:=}"
: "${SMTP_PASSWORD:=}"
: "${MAIL_FROM:=}"
: "${MAIL_TO:=}"

STATE=/tmp/watchdog
mkdir -p "$STATE"

now()  { date -u +%Y-%m-%dT%H:%M:%SZ; }
say()  { echo "$(now) $*"; }
secs() { date +%s; }

# ————— измерения —————

mem_free_pct() {
    awk '/^MemTotal:/ { t = $2 } /^MemAvailable:/ { a = $2 }
         END { if (t > 0) printf "%d", a * 100 / t; else printf "0" }' /proc/meminfo
}

disk_free_pct() {
    # Пятая колонка — «использовано», с процентом на конце. Свободное
    # считаем сами: df печатает занятое, а тревожит нас оставшееся.
    df -P "$DISK_PATH" | awk 'NR == 2 { gsub(/%/, "", $5); printf "%d", 100 - $5 }'
}

# ————— письмо —————

notify() {
    subject=$1
    body=$2
    footer="Память: $(mem_free_pct)% доступно. Диск: $(disk_free_pct)% свободно."

    if [ -z "$SMTP_HOST" ] || [ -z "$MAIL_TO" ]; then
        say "письмо НЕ отправлено (почта не настроена): $subject"
        return 0
    fi

    # Тема письма кириллицей без кодирования приезжает мусором почти в любой
    # почтовой программе. RFC 2047, base64.
    encoded=$(printf '%s' "$subject" | base64 | tr -d '\n')

    if {
        printf 'From: %s\r\n' "$MAIL_FROM"
        printf 'To: %s\r\n' "$MAIL_TO"
        printf 'Subject: =?UTF-8?B?%s?=\r\n' "$encoded"
        printf 'MIME-Version: 1.0\r\n'
        printf 'Content-Type: text/plain; charset=utf-8\r\n'
        printf '\r\n'
        printf '%s\r\n\r\n%s\r\n' "$body" "$footer"
    } | curl -s --max-time 30 --url "smtps://$SMTP_HOST:$SMTP_PORT" \
             --user "$SMTP_USER:$SMTP_PASSWORD" \
             --mail-from "$MAIL_FROM" --mail-rcpt "$MAIL_TO" \
             --upload-file - > /dev/null 2>&1
    then
        say "письмо отправлено: $subject"
    else
        # Отказ почты сам по себе новость: обычно он означает, что наружу
        # с машины уже не выйти, и остальные тревоги тоже не доедут.
        say "ПИСЬМО НЕ УШЛО: $subject"
    fi
}

# ————— состояние —————
#
# Состояние держится в файлах, а не в переменных: у sh нет ассоциативных
# массивов, а обходиться одной строкой с разделителями — это разбирать её
# на каждой итерации и ошибаться в разборе.

read_or() { cat "$STATE/$1" 2>/dev/null || printf '%s' "$2"; }

observe() {
    name=$1
    verdict=$2
    detail=$3

    was=$(read_or "$name.state" ok)
    fails=$(read_or "$name.fails" 0)

    if [ "$verdict" = ok ]; then
        printf '0' > "$STATE/$name.fails"
        if [ "$was" = bad ]; then
            printf 'ok' > "$STATE/$name.state"
            rm -f "$STATE/$name.told"
            say "ВОССТАНОВИЛОСЬ: $name — $detail"
            notify "VEDAL: проверка «$name» снова проходит" "$detail"
        fi
        return 0
    fi

    fails=$((fails + 1))
    printf '%s' "$fails" > "$STATE/$name.fails"

    # Одна неудачная проверка — ещё не авария. Перезапуск контейнера,
    # мгновение сетевой заминки и выкат дают ровно такую же картину,
    # и письмо на каждую из них научит читателя не открывать письма.
    if [ "$fails" -lt "$FAILS_TO_ALARM" ]; then
        say "сбой $fails/$FAILS_TO_ALARM: $name — $detail"
        return 0
    fi

    if [ "$was" != bad ]; then
        printf 'bad' > "$STATE/$name.state"
        secs > "$STATE/$name.told"
        say "ТРЕВОГА: $name — $detail"
        notify "VEDAL: не проходит проверка «$name»" \
               "Проверка «$name» не проходит $fails раза подряд. Подробность: $detail"
        return 0
    fi

    told=$(read_or "$name.told" 0)
    if [ $(( $(secs) - told )) -ge $(( REMIND_HOURS * 3600 )) ]; then
        secs > "$STATE/$name.told"
        say "ВСЁ ЕЩЁ ПЛОХО: $name — $detail"
        notify "VEDAL: проверка «$name» не проходит по-прежнему" \
               "Проверка «$name» не проходит $fails раза подряд. Подробность: $detail"
    fi
}

# ————— проверки —————

check_http() {
    name=$1
    url=$2
    forbidden=$3

    if [ -z "$forbidden" ]; then
        # Тело не нужно — не тащим его в память. Страница сайта весит
        # десятки килобайт, а проверка идёт раз в минуту круглосуточно.
        if err=$(curl -fsS --max-time 10 -o /dev/null "$url" 2>&1); then
            observe "$name" ok "отвечает"
        else
            observe "$name" bad "не отвечает: ${err:-таймаут}"
        fi
        return 0
    fi

    if body=$(curl -fsS --max-time 10 "$url" 2>&1); then
        if printf '%s' "$body" | grep -q "$forbidden"; then
            observe "$name" bad "ответил 200, но в теле есть «$forbidden»"
        else
            observe "$name" ok "отвечает"
        fi
    else
        observe "$name" bad "не отвечает: ${body:-таймаут}"
    fi
}

check_resources() {
    mem=$1
    disk=$2

    if [ "$mem" -lt "$MEM_FREE_MIN" ]; then
        observe память bad "доступно ${mem}% при пороге ${MEM_FREE_MIN}%"
    else
        observe память ok "доступно ${mem}%"
    fi

    if [ "$disk" -lt "$DISK_FREE_MIN" ]; then
        # Самый частый виновник здесь — не логи и не образы, а журнал
        # предзаписи PostgreSQL, который перестал вычищаться из-за
        # неактивного слота репликации.
        observe диск bad "свободно ${disk}% при пороге ${DISK_FREE_MIN}%"
    else
        observe диск ok "свободно ${disk}%"
    fi
}

# ————— главный цикл —————

say "сторож запущен: проверка раз в ${CHECK_EVERY}с, тревога после ${FAILS_TO_ALARM} неудач подряд"
say "пороги: память ${MEM_FREE_MIN}%, диск ${DISK_FREE_MIN}% (путь ${DISK_PATH})"
if [ -z "$SMTP_HOST" ] || [ -z "$MAIL_TO" ]; then
    say "ПОЧТА НЕ НАСТРОЕНА: тревоги будут только в этом журнале, письма не уйдут"
fi
for target in $TARGETS; do
    say "проверяю: ${target%%|*} -> $(printf '%s' "$target" | cut -d'|' -f2)"
done

while true; do
    mem=$(mem_free_pct)
    disk=$(disk_free_pct)

    check_resources "$mem" "$disk"

    # Напоминание про ненастроенную почту. Предупреждение со старта уезжает
    # вверх за первые же сутки, и вид работающего сторожа начинает означать
    # «нас предупредят» — хотя не предупредят.
    if [ -z "$SMTP_HOST" ] || [ -z "$MAIL_TO" ]; then
        last=$(read_or nomail.told 0)
        if [ $(( $(secs) - last )) -ge 3600 ]; then
            secs > "$STATE/nomail.told"
            say "ПОЧТА НЕ НАСТРОЕНА: тревоги никуда не уходят. Нужны SPRING_MAIL_HOST и VEDAL_WATCH_MAIL_TO"
        fi
    fi

    bad=""
    for target in $TARGETS; do
        name=$(printf '%s' "$target" | cut -d'|' -f1)
        url=$(printf '%s' "$target" | cut -d'|' -f2)
        forbidden=$(printf '%s' "$target" | cut -d'|' -f3)
        check_http "$name" "$url" "$forbidden"
        [ "$(read_or "$name.state" ok)" = bad ] && bad="$bad $name"
    done

    # Строка раз в минуту, в одну строку. Это и есть та история, по которой
    # потом отвечают на вопрос «что было в 03:40».
    if [ -n "$bad" ]; then
        say "память ${mem}% диск ${disk}% | НЕ ОТВЕЧАЮТ:$bad"
    else
        say "память ${mem}% диск ${disk}% | все отвечают"
    fi

    sleep "$CHECK_EVERY"
done
