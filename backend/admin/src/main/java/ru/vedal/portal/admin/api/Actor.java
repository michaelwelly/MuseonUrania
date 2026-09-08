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

    /**
     * Неизменяемый идентификатор учётной записи — `sub` из токена Keycloak.
     *
     * Логин переименовывают, `sub` — нет, и это единственное, чем портал
     * может отличить прежнего владельца логина от нового. Нужен ровно
     * в одном месте — у портрета сотрудника, см. StaffAvatars.
     *
     * В запасном режиме `vedal.iam.mode=local` токена нет вовсе, и здесь
     * пусто. Сравнивать тогда нечего, и портал ничего не сравнивает:
     * выдумать `sub` для локальной учётной записи значило бы завести
     * идентификатор, который ничему не соответствует.
     */
    static String subjectOf(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken token) {
            var subject = token.getToken().getSubject();
            return subject == null || subject.isBlank() ? null : subject;
        }
        return null;
    }

    private static String claim(Jwt jwt, String name) {
        var value = jwt.getClaimAsString(name);
        return value == null || value.isBlank() ? null : value;
    }
}
