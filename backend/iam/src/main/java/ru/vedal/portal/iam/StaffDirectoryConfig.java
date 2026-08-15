package ru.vedal.portal.iam;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

// Откуда портал берёт список сотрудников. Выбор — свойством `vedal.iam.mode`,
// тем же, что выбирает способ входа: два разных переключателя для входа
// и для справочника однажды разъехались бы, и портал пускал бы по Keycloak,
// а ответственных предлагал из таблицы запасного режима.
@Configuration
public class StaffDirectoryConfig {

    private static final Logger log = LoggerFactory.getLogger(StaffDirectoryConfig.class);

    @Bean
    @ConditionalOnProperty(name = "vedal.iam.mode", havingValue = "local", matchIfMissing = true)
    StaffDirectory localStaffDirectory(AdminUserRepository users) {
        log.info("Справочник сотрудников: таблица admin_user (режим local)");
        return new LocalStaffDirectory(users);
    }

    @Bean
    @ConditionalOnProperty(name = "vedal.iam.mode", havingValue = "keycloak")
    StaffDirectory keycloakStaffDirectory(
            RestClient.Builder http,
            @Value("${vedal.iam.admin-url:}") String adminUrl,
            @Value("${vedal.iam.issuer:}") String issuer,
            @Value("${vedal.iam.realm:vedal}") String realm,
            @Value("${vedal.iam.client-id:vedal-portal}") String clientId,
            @Value("${vedal.iam.client-secret:}") String clientSecret,
            AdminUserRepository users) {

        // Секрет не задан — значит, служебной учётной записи нет, и спрашивать
        // Keycloak нечем. Это рабочее состояние, а не поломка: до сегодняшнего
        // дня портал жил без справочника вовсе. Падать на старте здесь нельзя —
        // иначе отсутствие одной необязательной переменной кладёт весь портал
        // вместе с сайтом и формами.
        if (clientSecret.isBlank()) {
            log.warn("Справочник сотрудников: VEDAL_OIDC_CLIENT_SECRET не задан, "
                    + "ответственные берутся из таблицы admin_user. Чтобы читать их "
                    + "из Keycloak, заведите служебную учётную запись клиента с правом "
                    + "view-users и задайте секрет.");
            return new LocalStaffDirectory(users);
        }

        // Адрес для административного API — внутренний. Издатель для этого
        // не годится: в docker-сети он не резолвится, потому что в токене
        // стоит адрес, по которому за токеном ходил браузер.
        var base = adminUrl.isBlank() ? issuerBase(issuer) : adminUrl;
        log.info("Справочник сотрудников: Keycloak {} realm {}", base, realm);
        return new KeycloakStaffDirectory(http, base, realm, clientId, clientSecret);
    }

    /** Из `https://host/realms/vedal` получить `https://host`. */
    private static String issuerBase(String issuer) {
        var marker = issuer.indexOf("/realms/");
        return marker > 0 ? issuer.substring(0, marker) : issuer;
    }
}
