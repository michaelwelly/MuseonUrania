package ru.vedal.portal.iam;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import ru.vedal.portal.PostgresTestBase;

import static org.assertj.core.api.Assertions.assertThat;

// Портал поднимается в том режиме, в котором работает развёрнутая среда.
//
// Зачем отдельный тест на подъём контекста. Все остальные тесты идут в режиме
// vedal.iam.mode=local — он значение по умолчанию. В режиме keycloak создаются
// ДРУГИЕ бины: своя цепочка фильтров и справочник сотрудников, ходящий
// в административное API Keycloak. Ни один из них ни разу не собирался в тестах,
// и не собранный бин ломает не тест, а старт приложения.
//
// Так и вышло: справочник просит RestClient.Builder, класс RestClient приезжает
// со spring-web и компиляция проходит, а автоконфигурация, которая этот бин
// заводит, живёт в отдельном артефакте Spring Boot 4 и в сборку не попадала.
// Портал падал на старте с «required a bean of type RestClient$Builder» —
// в контейнере, в боевом режиме, при зелёной сборке.
//
// Проверка внутри метода от этого не спасала и не могла: пустой секрет
// служебной учётной записи разбирается в теле, а внедрение параметров
// происходит раньше. Отсутствующий бин валит создание независимо от того,
// собирался ли им кто-нибудь пользоваться.
@TestPropertySource(properties = {
        "vedal.iam.mode=keycloak",
        // Адреса заведомо недостижимые: ключи забираются при первой проверке
        // токена, а не на старте, и поднятого Keycloak этому тесту не нужно.
        "vedal.iam.issuer=http://localhost:1/realms/vedal",
        "vedal.iam.jwks-uri=http://localhost:1/realms/vedal/protocol/openid-connect/certs",
        "vedal.iam.audience=vedal-portal",
        // Секрет задан намеренно: с пустым справочник откатывается на таблицу
        // и ветку с Keycloak не проходит вовсе — то есть тест проверял бы
        // ровно тот путь, который и так работает.
        "vedal.iam.service-client-secret=проверка-подъёма",
        "vedal.iam.admin-url=http://localhost:1"
})
class StaffDirectoryKeycloakTest extends PostgresTestBase {

    @Autowired
    StaffDirectory directory;

    @Test
    void portalStartsInKeycloakMode() {
        assertThat(directory)
                .as("В боевом режиме справочник обязан ходить в Keycloak, а не в таблицу")
                .isInstanceOf(KeycloakStaffDirectory.class);
    }
}
