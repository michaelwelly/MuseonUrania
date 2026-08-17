package ru.vedal.portal.iam;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;

// Разбор ролей из токена Keycloak.
//
// Роли Keycloak кладёт не в `scope`, а в `realm_access.roles` и
// `resource_access.<client>.roles` — стандартный конвертер Spring Security
// про это не знает и не находит ни одной. Без этого класса токен проходит
// проверку подписи и всё равно получает 403: аутентификация есть,
// авторизации нет.
//
// Разбираются оба места. Роли realm'а — общие для всех приложений контура,
// роли клиента — только для портала; на первом этапе используются роли realm'а,
// но приезжать они могут и оттуда, и оттуда, и молча игнорировать половину
// источников значит однажды долго искать, почему у человека нет прав.
@Component
@ConditionalOnProperty(name = "vedal.iam.mode", havingValue = "keycloak")
public class KeycloakRoles implements Converter<Jwt, AbstractAuthenticationToken> {

    private final String clientId;

    public KeycloakRoles(@Value("${vedal.iam.client-id:vedal-portal}") String clientId) {
        this.clientId = clientId;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        Collection<GrantedAuthority> authorities = new LinkedHashSet<>();
        roles(jwt.getClaimAsMap("realm_access")).forEach(role -> authorities.add(authority(role)));

        var resources = jwt.getClaimAsMap("resource_access");
        if (resources != null && resources.get(clientId) instanceof Map<?, ?> client) {
            roles(client).forEach(role -> authorities.add(authority(role)));
        }

        return new JwtAuthenticationToken(jwt, authorities, name(jwt));
    }

    // Имя берём из preferred_username: `sub` — это UUID, и журнал по нему
    // не читается. Но запасной вариант обязателен: realm без клиентского scope
    // `profile` или токен сервисной учётной записи приезжают без этого
    // утверждения, и тогда имя оказывается null. Запись в журнал с actor = null
    // отбивается ограничением NOT NULL, то есть валидный токен с нужной ролью
    // ронял бы любую правку пятисотой.
    private static String name(Jwt jwt) {
        var username = jwt.getClaimAsString("preferred_username");
        if (username != null && !username.isBlank()) return username;

        var email = jwt.getClaimAsString("email");
        if (email != null && !email.isBlank()) return email;

        return jwt.getSubject();
    }

    private static List<String> roles(Map<?, ?> claim) {
        if (claim == null || !(claim.get("roles") instanceof Collection<?> roles)) return List.of();
        return roles.stream().filter(String.class::isInstance).map(String.class::cast).toList();
    }

    // portal-admin → ROLE_PORTAL_ADMIN. Дефис в имени роли Keycloak — норма,
    // подчёркивание в authority Spring Security — тоже; преобразование одно
    // и в одном месте.
    private static GrantedAuthority authority(String role) {
        return new SimpleGrantedAuthority(
                "ROLE_" + role.toUpperCase(Locale.ROOT).replace('-', '_'));
    }
}
