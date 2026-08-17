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
            @Schema(description = "Роли, которые портал разобрал в токене.")
            List<String> roles,
            @Schema(description = "Как портал проверяет вход: `keycloak` или `local`.")
            String authentication) {}

    private final String mode;

    public AdminSessionApi(@Value("${vedal.iam.mode:local}") String mode) {
        this.mode = mode;
    }

    @Operation(summary = "Кто вошёл")
    @GetMapping("/session")
    public Session session(Authentication who) {
        return new Session(Actor.of(who),
                who == null ? List.of()
                        : who.getAuthorities().stream().map(GrantedAuthority::getAuthority).toList(),
                mode);
    }
}
