package ru.vedal.portal.admin.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.ConflictException;
import ru.vedal.portal.iam.StaffDirectory;

import java.util.List;
import java.util.Map;

// Сотрудники, на которых можно записать заявку, клиента или сделку,
// и роли, которыми они пущены в портал.
//
// Завести человека, отключить его, сменить пароль, включить второй фактор —
// по-прежнему работа консоли Keycloak: провайдер идентичности мы покупаем,
// а не пишем. Здесь меняется ровно одно — набор ПОРТАЛЬНЫХ ролей.
//
// Из четырёх ограничений (перечислены в StaffDirectory) две держит эта
// дверь: свои роли менять нельзя и каждое изменение попадает в журнал.
// Первое — SecurityConfig, второе — сам порт.
@RestController
@RequestMapping("/api/admin/v1")
@Tag(name = "Админка: сотрудники")
@SecurityRequirement(name = "keycloak")
public class AdminStaffApi {

    private final StaffDirectory staff;
    private final AuditLog audit;

    public AdminStaffApi(StaffDirectory staff, AuditLog audit) {
        this.staff = staff;
        this.audit = audit;
    }

    @Operation(summary = "Сотрудники для выбора ответственного",
            description = """
                    Список из провайдера идентичности: в режиме `keycloak` — пользователи
                    realm'а, в запасном `local` — таблица `admin_user`.

                    Отключённые остаются в списке: на них есть старые заявки и сделки,
                    и прятать их значит терять историю. Форма предлагает их выбирать
                    только тем записям, где они уже стоят.
                    """)
    @GetMapping("/staff")
    public List<StaffDirectory.Person> staff() {
        return staff.staff();
    }

    public record Roles(
            @NotNull
            @io.swagger.v3.oas.annotations.media.Schema(
                    description = "Полный новый набор портальных ролей. "
                            + "Пустой список означает «в портал не пущен».",
                    example = "[\"portal-sales\"]")
            List<String> roles) {}

    @Operation(summary = "Выдать сотруднику набор портальных ролей",
            description = """
                    Набор целиком, а не «добавить одну»: что прислали, то и стало.
                    Пустой список снимает все портальные роли — человек остаётся
                    в системе входа, но в портал не пущен.

                    Только `portal-admin`. Свои роли изменить нельзя: иначе
                    достаточно один раз дорваться до этой двери, чтобы поднять
                    себя до администратора.

                    Роли вне портальных отвергаются, даже если у служебной учётной
                    записи хватает прав их назначить.
                    """)
    @PutMapping("/staff/{login}/roles")
    public List<StaffDirectory.Person> assign(@PathVariable String login,
                                              @RequestBody Roles body,
                                              Authentication who) {
        var actor = Actor.of(who);

        // Ограничение №3. Портал не спрашивает, зачем администратор снимает
        // роль с себя, — он просто не даёт этого сделать ни в какую сторону.
        // Разрешив «только повышать себе», мы получили бы дверь, через
        // которую любой, кто до неё добрался, становится администратором.
        if (login.equals(actor)) {
            throw new ConflictException("Свои роли через портал не меняются. "
                    + "Попросите другого администратора или сделайте это в Keycloak.");
        }

        var просят = body.roles() == null ? List.<String>of() : body.roles();

        // Ограничение №2, у двери. Та же проверка стоит в реализации порта,
        // и это не дублирование правила: СПИСОК ролей один — PORTAL_ROLES,
        // — а проверок две, потому что обещания разные. Дверь обещает
        // внятный отказ вместо похода в Keycloak; порт обещает, что через
        // него чужой ролью не распорядиться, кто бы его ни позвал.
        var чужие = просят.stream().filter(r -> !StaffDirectory.PORTAL_ROLES.contains(r)).toList();
        if (!чужие.isEmpty()) {
            throw new ConflictException("Портал распоряжается только своими ролями: "
                    + String.join(", ", StaffDirectory.PORTAL_ROLES)
                    + ". Не его: " + String.join(", ", чужие));
        }

        var было = ролиТого(login);

        try {
            staff.assignRoles(login, просят);
        } catch (StaffDirectory.Rejected e) {
            // Отказ провайдера — разговор с человеком, а не пятисотка:
            // «такого логина нет», «роль не наша», «режим ролями не управляет».
            throw new ConflictException(e.getMessage());
        }

        var стало = ролиТого(login);

        // Ограничение №4. В журнал пишется и «было», и «стало»: запись
        // «выдал роли» без прежнего набора не отвечает на вопрос,
        // что именно изменилось.
        audit.record(actor, "staff.roles", "staff", login,
                Map.of("было", было, "стало", стало));

        return staff.staff();
    }

    private List<String> ролиТого(String login) {
        return staff.staff().stream()
                .filter(p -> p.login().equals(login))
                .findFirst()
                .map(StaffDirectory.Person::roles)
                .orElse(List.of());
    }
}
