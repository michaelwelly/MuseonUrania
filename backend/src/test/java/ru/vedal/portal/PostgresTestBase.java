package ru.vedal.portal;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;

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

    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16");

    static {
        POSTGRES.start();
    }
}
