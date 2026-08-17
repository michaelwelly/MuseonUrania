package ru.vedal.portal.iam;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;

import java.util.List;

// Декодер токенов собирается здесь, а не автоконфигурацией Spring Boot.
//
// Причина: автоконфигурация включается самим фактом наличия свойства
// spring.security.oauth2.resourceserver.jwt.issuer-uri. Оставить его пустым
// в общих настройках нельзя — приложение попытается поднять декодер с пустым
// адресом и не стартует в режиме local, где Keycloak вообще нет.
@Configuration
@ConditionalOnProperty(name = "vedal.iam.mode", havingValue = "keycloak")
public class KeycloakDecoderConfig {

    @Bean
    JwtDecoder jwtDecoder(@Value("${vedal.iam.issuer}") String issuer,
                          @Value("${vedal.iam.jwks-uri:}") String jwksUri,
                          @Value("${vedal.iam.audience:}") String audience) {
        if (issuer.isBlank()) {
            // Падаем на старте и называем переменную поимённо — как
            // RequiredEnvironmentCheck для базы. Портал, поднявшийся в режиме
            // keycloak без Keycloak, отдал бы 401 на каждый запрос админки,
            // и искать причину пришлось бы в логах браузера.
            throw new IllegalStateException(
                    "vedal.iam.mode=keycloak, но адрес realm'а не задан: VEDAL_OIDC_ISSUER");
        }

        // Издатель и адрес ключей разведены намеренно.
        //
        // Поле iss в токене — это адрес, по которому за токеном ходил браузер.
        // Портал сверяет его буквально: несовпадение строки означает отказ.
        // Но забирать по этому же адресу ключи портал зачастую не может —
        // в docker-сети и в закрытом контуре внешний адрес Keycloak просто
        // не резолвится, а внутренний не годится для сверки, потому что
        // в токене его нет.
        //
        // Пусто — берём адрес ключей из /.well-known/openid-configuration
        // по адресу издателя. Так правильнее, когда адрес один: прописанный
        // руками JWKS однажды переживёт ротацию ключей на стороне Keycloak
        // и перестанет совпадать.
        var decoder = jwksUri.isBlank()
                ? (NimbusJwtDecoder) JwtDecoders.fromIssuerLocation(issuer)
                : NimbusJwtDecoder.withJwkSetUri(jwksUri).build();

        var validators = new java.util.ArrayList<OAuth2TokenValidator<Jwt>>();
        validators.add(JwtValidators.createDefaultWithIssuer(issuer));
        if (!audience.isBlank()) {
            validators.add(audienceIs(audience));
        }
        decoder.setJwtValidator(new org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator<>(validators));
        return decoder;
    }

    // Токен, выписанный другому клиенту того же realm'а, подписан теми же
    // ключами и проверку подписи проходит. Проверка получателя — единственное,
    // что отличает «токен для портала» от «токена вообще».
    private static OAuth2TokenValidator<Jwt> audienceIs(String audience) {
        return jwt -> {
            List<String> actual = jwt.getAudience();
            if (actual != null && actual.contains(audience)) {
                return OAuth2TokenValidatorResult.success();
            }
            return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token",
                    "Токен выписан не для портала: в aud нет " + audience, null));
        };
    }
}
