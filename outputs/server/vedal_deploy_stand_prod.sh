#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-main}"
ROOT="/opt/vedal-portal"
LOCK_DIR="$ROOT/var"
LOCK_FILE="$LOCK_DIR/deploy.lock"
LOG_FILE="$LOCK_DIR/deploy.log"
COMPOSE=(docker compose --env-file backend/.env -p vedal -f backend/compose.yaml -f backend/compose.host.yaml -f backend/compose.stand-prod.yaml --profile app)

mkdir -p "$LOCK_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another VEDAL deploy is already running. Try again later."
  exit 75
fi

exec > >(tee -a "$LOG_FILE") 2>&1

echo
echo "==== VEDAL stand-prod deploy $(date -Is) ===="
echo "branch: $BRANCH"

cd "$ROOT"

git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" up -d --build --remove-orphans
docker rm -f vedal-minio vedal-minio-init >/dev/null 2>&1 || true

echo "waiting for gateway..."
deadline=$(( "$(date +%s)" + 240 ))
while :; do
  if curl -fsS --connect-timeout 3 --max-time 10 http://127.0.0.1:18080/actuator/health >/dev/null; then
    break
  fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "gateway did not become healthy in time"
    "${COMPOSE[@]}" ps
    exit 1
  fi
  sleep 5
done

"${COMPOSE[@]}" ps
echo "public: http://51.250.31.97:18080"
echo "health: $(curl -fsS http://127.0.0.1:18080/actuator/health)"
echo "done: $(git rev-parse --short HEAD)"
