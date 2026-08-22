package ru.vedal.portal.iam;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Справочник сотрудников.
//
// Тесты идут в режиме `local` — том, в котором поднимается тестовый контекст.
// Реализация на Keycloak здесь не проверяется намеренно: поднимать realm
// ради проверки одного GET значит менять цену прогона всей сборки, а разбор
// ответа Keycloak проверяется отдельно, без сети.
@AutoConfigureMockMvc
class StaffDirectoryTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Autowired
    StaffDirectory staff;

    @Autowired
    AdminUserRepository users;

    private void account(String login, String name, boolean enabled) {
        var user = new AdminUser();
        user.setId(UUID.randomUUID());
        user.setUsername(login);
        user.setDisplayName(name);
        user.setPasswordHash("не проверяется в этом тесте");
        user.setEnabled(enabled);
        users.saveAndFlush(user);
    }

    // В режиме local справочник — это те же учётные записи, под которыми
    // в портал и входят. Второй список означал бы, что ответственного можно
    // выбрать из людей, которых в портале нет.
    @Test
    void localModeListsTheAccountsPeopleSignInWith() {
        account("fedorova", "Анна Фёдорова", true);

        assertThat(staff.staff())
                .extracting(StaffDirectory.Person::login)
                .contains("fedorova");
    }

    // Отключённый сотрудник остаётся в списке: на нём висят старые сделки,
    // и убрать его значит показать сделку без ответственного.
    @Test
    void disabledStaffStayInTheListAndAreMarked() {
        account("uvolen", "Пётр Уволенный", false);

        var found = staff.staff().stream()
                .filter(p -> p.login().equals("uvolen"))
                .findFirst();

        assertThat(found).isPresent();
        assertThat(found.get().enabled()).isFalse();
    }

    // Показываем имя, а если его нет — логин. Пустая строка в выпадающем
    // списке не выбирается: человек не знает, кого он выбрал.
    @Test
    void labelFallsBackToLoginWhenThereIsNoName() {
        assertThat(new StaffDirectory.Person("bez.imeni", null, true).label()).isEqualTo("bez.imeni");
        assertThat(new StaffDirectory.Person("bez.imeni", "  ", true).label()).isEqualTo("bez.imeni");
        assertThat(new StaffDirectory.Person("fedorova", "Анна Фёдорова", true).label())
                .isEqualTo("Анна Фёдорова");
    }

    @Test
    // Справочник сотрудников показывает состав компании, и роль здесь
    // административная: ни продажам, ни тем, кто ведёт сайт, он для работы
    // не нужен. Раньше в тесте стояла роль редактора — тогда все роли
    // давали одно и то же, и выбор был безразличен.
    @WithMockUser(roles = "PORTAL_ADMIN")
    void doorReturnsStaffForTheAdminUi() throws Exception {
        account("fedorova", "Анна Фёдорова", true);

        mvc.perform(get("/api/admin/v1/staff"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.login == 'fedorova')].name").value("Анна Фёдорова"));
    }

    // Дверь админская, значит закрыта как остальные: без токена ответ 401,
    // а не список сотрудников.
    @Test
    void doorIsClosedWithoutAToken() throws Exception {
        mvc.perform(get("/api/admin/v1/staff")).andExpect(status().isUnauthorized());
    }
}
