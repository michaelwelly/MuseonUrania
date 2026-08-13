package ru.vedal.portal.iam;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

// Дверь админского API. Две реализации, выбор — свойством vedal.iam.mode,
// как и у EventPublisher с FileStorage: молчаливый выбор «какой бин нашёлся»
// однажды означает открытую дверь.
//
//   keycloak — боевой режим. Портал проверяет токен и разбирает роли; выдаёт
//              токены и хранит пароли Keycloak, MFA настраивается там же.
//   local    — запасной режим для разработки и для случая, когда провайдера
//              идентичности ещё нет. Basic поверх учётных записей в базе.
//
// Правила доступа общие — они в SecurityConfig.adminApiBaseline. Разъехавшись,
// эти два режима означали бы, что разработка проверяет не то правило,
// что развёрнутая среда.
@Configuration
public class AdminApiSecurityConfig {

    @Configuration
    @ConditionalOnProperty(name = "vedal.iam.mode", havingValue = "keycloak")
    static class Keycloak {

        @Bean
        @Order(1)
        SecurityFilterChain adminApiChain(HttpSecurity http, KeycloakRoles roles) throws Exception {
            return SecurityConfig.adminApiBaseline(http)
                    .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.jwtAuthenticationConverter(roles)))
                    .build();
        }
    }

    @Configuration
    @ConditionalOnProperty(name = "vedal.iam.mode", havingValue = "local", matchIfMissing = true)
    static class Local {

        @Bean
        @Order(1)
        SecurityFilterChain adminApiChain(HttpSecurity http) throws Exception {
            // Basic, а не форма и cookie: админка на фронте — отдельный адрес,
            // и cookie-сессия между доменами означала бы SameSite=None,
            // то есть тот самый ambient authority, от которого дверь ушла.
            return SecurityConfig.adminApiBaseline(http)
                    .httpBasic(Customizer.withDefaults())
                    .build();
        }
    }
}
