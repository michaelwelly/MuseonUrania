package ru.vedal.portal.admin.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Locale;

// Кто вошёл. Админка на фронте спрашивает это первым делом: токен может быть
// подписан правильно и всё равно не подойти — не тот realm, не та аудитория,
// нет роли. Ответ «кто я по мнению портала» отличает «токен не приняли»
// от «данных нет».
@RestController
@RequestMapping("/api/admin/v1")
@Tag(name = "Админка: сессия")
@SecurityRequirement(name = "keycloak")
public class AdminSessionApi {

    @Schema(name = "AdminSession")
    public record Session(
            @Schema(description = "Логин, под которым действия попадут в журнал.")
            String actor,
            @Schema(description = "Роли realm'а, которые портал разобрал в токене: "
                    + "`portal-admin`, `portal-sales`, `portal-production`.")
            List<String> roles,
            @Schema(description = "Как портал проверяет вход: `keycloak` или `local`.")
            String authentication) {}

    private final String mode;

    public AdminSessionApi(@Value("${vedal.iam.mode:local}") String mode) {
        this.mode = mode;
    }

    // Приставка Spring и форма записи роли в realm'е.
    //
    // Внутри портала роль живёт как ROLE_PORTAL_ADMIN: так её требует
    // hasRole, и так её кладёт KeycloakRoles. Наружу отдаётся portal-admin —
    // то самое имя, которое стоит в realm'е и которое админка сверяет
    // в roles.ts.
    private static final String PREFIX = "ROLE_PORTAL_";

    @Operation(summary = "Кто вошёл")
    @GetMapping("/session")
    public Session session(Authentication who) {
        return new Session(Actor.of(who), roles(who), mode);
    }

    // Что было. Отдавались authorities как есть, то есть ROLE_PORTAL_ADMIN
    // и заодно все SCOPE_*. Админка сверяет их со строкой portal-admin
    // (roles.ts), совпадений не находила НИКОГДА — и человек с полными
    // правами видел пустую оболочку: портал его пускал, а интерфейс
    // не предлагал ни одной двери.
    //
    // Отказ был тихий вдвойне. Тесты фронтенда подставляли в фикстуры
    // portal-admin — форму, которой портал не отдавал никогда, — и зеленели
    // на выдумке. Тесты бэкенда проверяли у /session только код ответа.
    //
    // Чинится здесь, а не в roles.ts: приставка ROLE_ и SCOPE_ — внутреннее
    // устройство Spring Security, и клиенту про него знать незачем. Имя роли
    // в realm'е — это то, что администратор видит в консоли Keycloak
    // и что портал показывает человеку в отказе («нужна роль portal-sales»).
    private static List<String> roles(Authentication who) {
        if (who == null) return List.of();

        return who.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith(PREFIX))
                .map(a -> "portal-" + a.substring(PREFIX.length())
                        .toLowerCase(Locale.ROOT)
                        .replace('_', '-'))
                .sorted()
                .toList();
    }
}
