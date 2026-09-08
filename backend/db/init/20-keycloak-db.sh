#!/bin/sh
# База для собственного хранилища Keycloak. compose.prod.yaml переводит
# Keycloak в режим `start` с KC_DB=postgres и указывает ему адрес
#
#   jdbc:postgresql://db:5432/${VEDAL_KEYCLOAK_DB_NAME:-keycloak}
#
# — но саму базу по этому адресу никто не заводил. PostgreSQL не создаёт базу
# по факту подключения: JDBC-драйвер Keycloak умеет накатить туда СВОИ таблицы
# (через встроенный Liquibase), но только если сама база уже существует.
# Без этого файла Keycloak в прод-режиме не поднимется вовсе — не на пустом
# месте: на локальном стеке и на текущем стенде (compose.stand-prod.yaml)
# Keycloak до сих пор работает в режиме start-dev со встроенной базой
# (KC_DB не задан), и этот путь ни разу не проходили в развёрнутой среде.
#
# Тот же залог, что и у роли рантайма рядом: скрипт выполняется
# entrypoint'ом образа postgres и ТОЛЬКО при создании кластера, то есть
# на пустом томе. На уже существующем томе он не запустится — база заводится
# один раз и переживает пересоздание контейнера вместе с остальными данными
# в этом же томе.
#
# В Managed PostgreSQL база заводится консолью или `yc managed-postgresql
# database create`, этот файл там не выполняется вовсе — как и с ролью
# рантайма, существование базы в облаке остаётся заботой окружения,
# а не compose.

set -eu

KEYCLOAK_DB="${VEDAL_KEYCLOAK_DB_NAME:-keycloak}"

psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" \
     --dbname "$POSTGRES_DB" \
     -v dbname="$KEYCLOAK_DB" <<'SQL'
create database :"dbname";
SQL

echo "База $KEYCLOAK_DB для Keycloak заведена; таблицы в неё накатит сам Keycloak при старте."
