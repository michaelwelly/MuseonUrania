package ru.vedal.portal.admin.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.vedal.portal.iam.StaffDirectory;

import java.util.List;

// Сотрудники, на которых можно записать заявку, клиента или сделку.
//
// Только чтение. Завести человека, выдать роль и отключить при увольнении —
// работа консоли Keycloak: провайдер идентичности мы покупаем, а не пишем,
// и вторая дверь к учётным записям означала бы два места, где их заводят.
@RestController
@RequestMapping("/api/admin/v1")
@Tag(name = "Админка: сотрудники")
@SecurityRequirement(name = "keycloak")
public class AdminStaffApi {

    private final StaffDirectory staff;

    public AdminStaffApi(StaffDirectory staff) {
        this.staff = staff;
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
}
