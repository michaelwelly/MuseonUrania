#!/usr/bin/env bash
#
# Собрать PDF политики обработки персональных данных из самой страницы.
#
#   ./frontend/scripts/privacy-pdf.sh
#
# ————— зачем скрипт, а не файл в репозитории —————
#
# ПРАВИЛО: правишь текст политики (frontend/content/legal.ts → privacy) —
# пересобираешь PDF этим скриптом тем же коммитом. Иначе на странице одна
# редакция, а в скачанном файле другая, и разойдутся они молча: страницу
# правят через полгода, файл никто не открывает, а человек скачивает именно
# файл и считает его действующим документом.
#
# По той же причине PDF печатается ИЗ НАШЕЙ страницы, а не верстается
# отдельно: два независимых источника одного юридического текста — это
# гарантированное расхождение, вопрос только в сроке.
#
# Скрипт заодно проставляет размер файла в content/legal.ts (privacyPdf.size):
# рядом со ссылкой «Скачать PDF» стоит размер, и цифра, поставленная на глаз,
# обещает человеку не тот файл, который он получит.
#
# ————— чем печатается —————
#
# Headless-браузером, который на машине уже есть: Chrome или Edge. Отдельной
# зависимости для одного файла в проект не приезжает — ни pdf-библиотеки,
# ни Puppeteer с собственной сборкой Chromium.
#
# Печать честная, через тот же движок, который показывает страницу человеку.
# Шапка сайта, подвал, плашка про cookie и кнопка чата в файл не попадают —
# их убирают print-стили в app/(site)/legal/privacy/page.module.css.

set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${PRIVACY_PDF_PORT:-4319}"
URL="http://127.0.0.1:${PORT}/legal/privacy/"
OUT="public/documents/vedal-privacy-policy.pdf"
CONTENT="content/legal.ts"

say() { printf '\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

# ————— браузер —————

BROWSER=""
for candidate in \
  "/c/Program Files/Google/Chrome/Application/chrome.exe" \
  "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
  "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  "/c/Program Files/Microsoft/Edge/Application/msedge.exe" \
  "$(command -v google-chrome || true)" \
  "$(command -v chromium || true)"; do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then BROWSER="$candidate"; break; fi
done

[ -n "$BROWSER" ] || fail \
  "Не найден Chrome или Edge. Печатать нечем: поставьте браузер или укажите путь в BROWSER."

# ————— сборка и запуск —————
#
# Печатается боевая сборка, а не `next dev`: в режиме разработки на странице
# живёт индикатор сборки и оверлей ошибок, и они попадают в файл.

if [ "${PRIVACY_PDF_SKIP_BUILD:-}" != "1" ]; then
  say "Сборка фронтенда"
  npm run build
fi

say "Запуск сайта на порту ${PORT}"
npx next start -p "$PORT" >/tmp/privacy-pdf-server.log 2>&1 &
SERVER=$!

# Гасим сервер при любом выходе, включая ошибку печати: висящий next start
# держит порт, и следующий запуск скрипта молча напечатает прошлую страницу.
#
# На Windows одного kill мало, и это проверено: `npx` — это обёртка, а сервер
# живёт в её потомке. Оболочка убивает обёртку, рапортует об успехе, а порт
# остаётся занят до перезагрузки. Поэтому дерево процессов гасится taskkill,
# если он есть, и обычным сигналом, если нет.
# На Windows одного kill мало, и это проверено: `npx` — обёртка, сервер живёт
# в её потомке, а PID обёртки в оболочке msys не тот, что знает система.
# Оболочка убивает обёртку, рапортует об успехе, порт остаётся занят — и
# следующий запуск скрипта молча печатает страницу прошлой сборки. Поэтому
# после сигнала добиваем того, кто держит порт.
cleanup() {
  kill "$SERVER" 2>/dev/null || true
  if command -v netstat >/dev/null 2>&1 && command -v taskkill >/dev/null 2>&1; then
    for pid in $(netstat -ano 2>/dev/null | grep LISTENING | grep ":${PORT} " | awk '{print $NF}' | sort -u); do
      MSYS_NO_PATHCONV=1 taskkill /PID "$pid" /F >/dev/null 2>&1 || true
    done
  fi
  wait "$SERVER" 2>/dev/null || true
}
trap cleanup EXIT

# 127.0.0.1, а не localhost: localhost на этой машине уходит в IPv6 и запрос
# висит до таймаута, хотя сервер поднят и отвечает.
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "$URL"; then break; fi
  sleep 1
done
curl -fsS -o /dev/null "$URL" || fail "Сайт не поднялся: см. /tmp/privacy-pdf-server.log"

# ————— печать —————

mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"

# Пути для Windows-браузера — в его виде; MSYS_NO_PATHCONV, чтобы оболочка
# не переписала адрес страницы по дороге.
WIN_OUT="$(cygpath -w "$(pwd)/$OUT" 2>/dev/null || printf '%s' "$(pwd)/$OUT")"
PROFILE="$(mktemp -d)"
WIN_PROFILE="$(cygpath -w "$PROFILE" 2>/dev/null || printf '%s' "$PROFILE")"

say "Печать ${URL}"
# --user-data-dir обязателен: без него команда уходит в уже открытый у
# разработчика Chrome и завершается, ничего не напечатав.
# --virtual-time-budget даёт странице догрузить шрифты и выполнить скрипты:
# без него печатается первый кадр, где текст ещё без начертания.
MSYS_NO_PATHCONV=1 "$BROWSER" \
  --headless \
  --disable-gpu \
  --no-first-run \
  --no-default-browser-check \
  --user-data-dir="$WIN_PROFILE" \
  --virtual-time-budget=10000 \
  --no-pdf-header-footer \
  --print-to-pdf="$WIN_OUT" \
  "$URL"

rm -rf "$PROFILE"
[ -s "$OUT" ] || fail "Файл не создан: $OUT"

# ————— размер в тексте страницы —————

BYTES="$(wc -c <"$OUT" | tr -d ' ')"
KB=$(((BYTES + 1023) / 1024))
sed -i "s/^\( *size: \)\"[^\"]*\",\$/\1\"${KB} КБ\",/" "$CONTENT"
grep -q "\"${KB} КБ\"" "$CONTENT" || fail \
  "Размер не проставлен в ${CONTENT}: проверьте поле size у privacyPdf."

say "Готово: ${OUT} — ${KB} КБ"
say "Проверьте, что дата редакции в ${CONTENT} (PRIVACY_REVISION) совпадает с сегодняшней правкой."
