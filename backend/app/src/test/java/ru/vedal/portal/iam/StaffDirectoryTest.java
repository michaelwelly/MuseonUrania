package ru.vedal.portal.iam;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
        var никаких = java.util.List.<String>of();
        assertThat(new StaffDirectory.Person("bez.imeni", null, true, никаких).label())
                .isEqualTo("bez.imeni");
        assertThat(new StaffDirectory.Person("bez.imeni", "  ", true, никаких).label())
                .isEqualTo("bez.imeni");
        assertThat(new StaffDirectory.Person("fedorova", "Анна Фёдорова", true, никаких).label())
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

    // Роли приезжают вместе с сотрудником.
    //
    // Раньше справочник отдавал логин, имя и признак «работает», и вопрос
    // «кто у нас продажи, а кто ведёт сайт» отвечался только в консоли
    // Keycloak. Теперь роли видны там же, где состав.
    //
    // В запасном режиме у единственной учётной записи все три — ровно те,
    // что выдаёт ей SecurityConfig. Проверка сверяет со списком порта,
    // а не с переписанной руками тройкой: разойдись они, тест зеленел бы
    // на собственной копии правды.
    @Test
    @WithMockUser(roles = "PORTAL_ADMIN")
    void staffCarriesPortalRoles() throws Exception {
        account("fedorova", "Анна Фёдорова", true);

        var found = staff.staff().stream()
                .filter(p -> p.login().equals("fedorova"))
                .findFirst()
                .orElseThrow();

        assertThat(found.roles()).isEqualTo(StaffDirectory.PORTAL_ROLES);

        mvc.perform(get("/api/admin/v1/staff"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.login == 'fedorova')].roles[0]")
                        .value("portal-admin"));
    }

    // Дверь админская, значит закрыта как остальные: без токена ответ 401,
    // а не список сотрудников.
    @Test
    void doorIsClosedWithoutAToken() throws Exception {
        mvc.perform(get("/api/admin/v1/staff")).andExpect(status().isUnauthorized());
    }
    // ————— выдача ролей —————

    // Ограничение №3: свои роли не меняются.
    //
    // Без него достаточно один раз дорваться до этой двери, чтобы поднять
    // себя до администратора. Запрет односторонним не сделан намеренно:
    // разрешив «себе можно только снимать», мы получили бы правило,
    // которое надо проверять на каждой правке, вместо запрета, который
    // не надо проверять никогда.
    @Test
    @WithMockUser(username = "boss", roles = "PORTAL_ADMIN")
    void ownRolesCannotBeChangedThroughThePortal() throws Exception {
        mvc.perform(put("/api/admin/v1/staff/boss/roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roles\":[\"portal-admin\",\"portal-sales\"]}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(
                        org.hamcrest.Matchers.containsString("Свои роли")));
    }

    // Ограничение №2: чужие роли realm'а порталу недоступны.
    //
    // Проверка не теоретическая. Служебной учётной записи выдан
    // manage-users, и без этого запрета через дверь назначался бы
    // realm-admin — то есть портал раздавал бы права на сам Keycloak.
    @Test
    @WithMockUser(username = "boss", roles = "PORTAL_ADMIN")
    void rolesOutsideThePortalAreRefused() throws Exception {
        mvc.perform(put("/api/admin/v1/staff/fedorova/roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roles\":[\"realm-admin\"]}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(
                        org.hamcrest.Matchers.containsString("realm-admin")));
    }

    // Портальную роль дверь принимает и доносит до провайдера.
    //
    // В тестах работает запасной режим, а он ролями не управляет: у него
    // одна учётная запись и все роли сразу. Отказ здесь — правильный ответ,
    // и он проверяется словами, а не кодом: человек должен прочитать,
    // ПОЧЕМУ не вышло, а не гадать над «409».
    //
    // Эта же проверка сторожит порядок: если бы запрет на свои роли или
    // проверка списка стояли ПОСЛЕ обращения к провайдеру, сюда приехало
    // бы другое сообщение.
    @Test
    @WithMockUser(username = "boss", roles = "PORTAL_ADMIN")
    void aPortalRoleReachesTheIdentityProvider() throws Exception {
        mvc.perform(put("/api/admin/v1/staff/fedorova/roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roles\":[\"portal-sales\"]}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(
                        org.hamcrest.Matchers.containsString("Запасной режим")));
    }
}
