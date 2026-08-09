package ru.vedal.portal;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// Настоящий PostgreSQL, а не H2: различия диалектов должны вылезать здесь,
// а не в проде. Контейнер один на все тесты — static.
//
// Откат после каждого теста: контейнер общий, а сид из V2 проверяется на точное
// число позиций. Без откатов тест, добавивший свою запись, ломает SeedTest.
@SpringBootTest
@Testcontainers
@Transactional
public abstract class PostgresTestBase {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16");
}
