package ru.vedal.portal.admin.api;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

// Кто именно совершил действие — для журнала.
//
// Источников входа два: сессия локальной учётной записи (запасной профиль)
// и токен Keycloak. У токена Principal.getName() — это `sub`, то есть UUID
// пользователя в Keycloak. Писать его в журнал значит получить журнал, по
// которому без запроса в Keycloak не понять, кто это был.
final class Actor {

    private Actor() {}

    static String of(Authentication authentication) {
        if (authentication == null) return "anonymous";

        if (authentication instanceof JwtAuthenticationToken token) {
            var jwt = token.getToken();
            var username = claim(jwt, "preferred_username");
            if (username != null) return username;
            var email = claim(jwt, "email");
            if (email != null) return email;
            if (jwt.getSubject() != null) return jwt.getSubject();
        }

        // Последняя защита: actor в журнале объявлен NOT NULL, и пустое имя
        // уронило бы не запись в журнал, а всё действие целиком. Строка
        // «unknown» в журнале хуже настоящего логина, но лучше пятисотой
        // на правке карточки.
        var name = authentication.getName();
        return name == null || name.isBlank() ? "unknown" : name;
    }

    private static String claim(Jwt jwt, String name) {
        var value = jwt.getClaimAsString(name);
        return value == null || value.isBlank() ? null : value;
    }
}
