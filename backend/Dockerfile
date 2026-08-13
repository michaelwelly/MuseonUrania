# Образ портала.
#
# Собирается из исходников внутри образа, а не из готового jar с машины
# разработчика: собранный локально jar зависит от того, что установлено
# на этой машине, и «у меня работает» перестаёт быть шуткой ровно в тот
# момент, когда образ уезжает на сервер.

FROM eclipse-temurin:25-jdk AS build
WORKDIR /build

# Сначала pom и обёртка, потом исходники. Слой с зависимостями
# переиспользуется, пока pom.xml не поменялся, — правка одного класса
# не тянет за собой повторную выкачку всего Maven Central.
COPY .mvn .mvn
COPY mvnw pom.xml ./
# Перевод строк выправляется здесь, а не только .gitattributes: Docker копирует
# рабочее дерево, а не индекс. На Windows файл с CRLF уносит \r в строку
# shebang, и сборка падает с './mvnw: not found' — сообщением, по которому
# причину видно последней.
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw

COPY src src

# Кэш Maven живёт между сборками образа, а не внутри слоя: класть ~/.m2
# в слой значит носить сотню мегабайт зависимостей в каждом образе.
#
# Тесты здесь не идут намеренно: они поднимают PostgreSQL через
# Testcontainers, то есть требуют Docker внутри сборки Docker. Их место —
# в CI перед сборкой образа, и образ собирается только из зелёного дерева.
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -DskipTests package

FROM eclipse-temurin:25-jre AS runtime

# curl нужен healthcheck'у в compose. Пакет ставится в runtime, а не
# тащится из сборочного образа: там он был бы вместе с JDK и Maven.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Не root. Приложение пишет только во временный каталог и (в режиме local)
# в каталог хранилища — права root ему не нужны ни для чего.
RUN useradd --system --create-home --uid 10001 vedal
USER vedal
WORKDIR /app

COPY --from=build --chown=vedal:vedal /build/target/portal-*.jar app.jar

# Каталог для режима vedal.storage.kind=local. В стеке compose хранилище
# объектное, и этот каталог остаётся пустым — но образ не должен падать
# только потому, что кто-то запустил его без MinIO.
RUN mkdir -p /app/var/documents
VOLUME ["/app/var/documents"]

EXPOSE 8081

# Контейнер получает сигнал остановки напрямую, без оболочки-посредника:
# иначе Spring не успевает закрыть соединения и долить outbox, и docker
# добивает процесс по таймауту.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
