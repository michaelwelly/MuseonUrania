# Образ шлюза. Отдельный от портала, потому что и приложение отдельное:
# у него своя версия Spring Boot (4.0.x под Spring Cloud Gateway 5.0.x),
# и складывать их в один образ значило бы выбрать одну версию на оба.

FROM eclipse-temurin:25-jdk AS build
WORKDIR /build

COPY .mvn .mvn
COPY mvnw pom.xml ./
# Перевод строк выправляется здесь, а не только .gitattributes: Docker копирует
# рабочее дерево, а не индекс. На Windows файл с CRLF уносит \r в строку
# shebang, и сборка падает с './mvnw: not found' — сообщением, по которому
# причину видно последней.
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw

COPY src src

RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -DskipTests package

FROM eclipse-temurin:25-jre AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --system --create-home --uid 10002 vedal
USER vedal
WORKDIR /app

COPY --from=build --chown=vedal:vedal /build/target/api-gateway-*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
