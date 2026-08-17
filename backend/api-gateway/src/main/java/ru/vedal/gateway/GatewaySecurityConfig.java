package ru.vedal.gateway;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoders;
import org.springframework.security.web.server.SecurityWebFilterChain;

// Периметр шлюза.
//
// Ключевое: даже в строгом режиме шлюз проверяет только то, что токен
// настоящий и не истёк. Роли, права на конкретное изделие и запись в журнал —
// работа портала. Раздвоить это решение значит однажды поймать расхождение,
// при котором шлюз пускает, а портал отказывает, или наоборот.
@Configuration
@EnableWebFluxSecurity
public class GatewaySecurityConfig {

    // Открытый режим. Шлюз ничего не решает и просто передаёт заголовок
    // Authorization порталу — тот проверит его сам.
    @Configuration
    @ConditionalOnProperty(name = "vedal.gateway.verify-tokens", havingValue = "false",
            matchIfMissing = true)
    static class PassThrough {

        @Bean
        SecurityWebFilterChain chain(ServerHttpSecurity http) {
            return http
                    .csrf(ServerHttpSecurity.CsrfSpec::disable)
                    .authorizeExchange(auth -> auth.anyExchange().permitAll())
                    .build();
        }
    }

    @Configuration
    @ConditionalOnProperty(name = "vedal.gateway.verify-tokens", havingValue = "true")
    static class VerifyTokens {

        @Bean
        SecurityWebFilterChain chain(ServerHttpSecurity http) {
            return http
                    // Сессии у шлюза нет, запрос опознаётся по заголовку —
                    // защищать CSRF-токеном нечего.
                    .csrf(ServerHttpSecurity.CsrfSpec::disable)
                    .authorizeExchange(auth -> auth
                            // Двери правки требуют настоящего токена уже здесь.
                            .pathMatchers("/api/admin/**").authenticated()
                            // Всё остальное — публичный сайт и его API. Закрыть
                            // их здесь значит закрыть сайт.
                            .anyExchange().permitAll())
                    .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> {}))
                    .build();
        }

        // Декодер собирается руками по той же причине, что и в портале:
        // автоконфигурация Spring Boot включается самим фактом наличия
        // spring.security.oauth2.resourceserver.jwt.issuer-uri, и пустое
        // значение не дало бы шлюзу стартовать в открытом режиме.
        @Bean
        ReactiveJwtDecoder jwtDecoder(
                @org.springframework.beans.factory.annotation.Value("${vedal.gateway.oidc-issuer}")
                String issuer) {
            if (issuer.isBlank()) {
                throw new IllegalStateException(
                        "vedal.gateway.verify-tokens=true, но адрес realm'а не задан: "
                                + "VEDAL_OIDC_ISSUER");
            }
            return ReactiveJwtDecoders.fromIssuerLocation(issuer);
        }
    }
}
