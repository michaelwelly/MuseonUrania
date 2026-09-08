package ru.vedal.portal;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import java.sql.DriverManager;
import java.sql.SQLException;

// Настоящий PostgreSQL, а не H2: различия диалектов должны вылезать здесь,
// а не в проде.
//
// Контейнер запускается статическим блоком и НЕ управляется аннотациями
// @Testcontainers/@Container. Причина конкретная: расширение JUnit гасит
// статический контейнер после каждого тестового класса, а контексты Spring
// кэшируются и переиспользуются между классами — второй класс получал бы
// контекст со старым, уже недоступным портом и падал на
// «Connection is not available». Здесь контейнер один на всю JVM, останавливает
// его Ryuk по завершении процесса.
//
// Откат после каждого теста: контейнер общий, а сид из V2 проверяется на точное
// число позиций. Без откатов тест, добавивший свою запись, ломает SeedTest.
@SpringBootTest
@Transactional
public abstract class PostgresTestBase {

    // Роль, под которой приложение ходит в базу в развёрнутой среде. Права ей
    // выдаёт миграция V16, а заводится она здесь — до того, как миграция
    // применится, иначе V16 остановит сборку с требованием её создать.
    //
    // Почему роль не создаётся самой миграцией: у неё есть пароль, а пароль
    // в миграции проезжает через текст запроса и оседает в pg_stat_activity
    // и в логах. Плюс в Managed PostgreSQL роль всё равно заводится снаружи —
    // владельцу схемы там не выдают CREATEROLE. Существование роли и её пароль
    // остаются заботой окружения, права — заботой миграции.
    public static final String RUNTIME_ROLE = "vedal_app";
    public static final String RUNTIME_PASSWORD = "vedal-app-test";

    /**
     * Образ базы: тот же PostgreSQL 16, что в стеке, плюс расширение pgvector.
     *
     * <p>Расширение — требование миграции V34 (хранилище векторов Ведалины):
     * на голом {@code postgres:16} она падает с «extension "vector" is not
     * available», то есть тесты не поднимаются вовсе.
     *
     * <p>{@code asCompatibleSubstituteFor} нужен потому, что Testcontainers
     * узнаёт базу по имени образа: незнакомое имя он не свяжет с
     * {@link PostgreSQLContainer} и не подставит ни драйвер, ни строку
     * подключения. Здесь мы утверждаем то, что и есть на самом деле —
     * это тот же postgres, собранный с ещё одной библиотекой.
     */
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>(
            DockerImageName.parse("pgvector/pgvector:pg16")
                    .asCompatibleSubstituteFor("postgres"));

    static {
        POSTGRES.start();
        createRuntimeRole();
    }

    private static void createRuntimeRole() {
        try (var connection = DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             var statement = connection.createStatement()) {

            statement.execute(
                    "create role " + RUNTIME_ROLE + " login password '" + RUNTIME_PASSWORD + "'");

        } catch (SQLException e) {
            throw new IllegalStateException(
                    "Не удалось завести роль рантайма " + RUNTIME_ROLE
                            + ". Без неё миграция V16 остановит сборку.", e);
        }
    }
}
