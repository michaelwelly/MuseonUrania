package ru.vedal.portal.admin.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.chat.DutyRoster;
import ru.vedal.portal.iam.AdminUser;
import ru.vedal.portal.iam.AdminUserRepository;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Дверь дежурства.
 *
 * <p>Домен проверен отдельно ({@code DutyRosterTest}); здесь — то, что
 * добавляет дверь и чего в домене нет: логин превращается в имя, а логин,
 * которого нет в справочнике, отвергается. Внешнего ключа на сотрудника
 * не будет никогда — сотрудники живут в Keycloak, — и эта проверка
 * единственная.
 *
 * <p>Справочник идёт в режиме `local`: тестовый контекст поднимается в нём,
 * и учётная запись здесь заводится напрямую в таблицу — та же самая, под
 * которой в портал и входят.
 */
@AutoConfigureMockMvc
class AdminDutyApiTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Autowired
    AdminUserRepository users;

    @Autowired
    DutyRoster roster;

    private void account(String login, String name, boolean enabled) {
        var user = new AdminUser();
        user.setId(UUID.randomUUID());
        user.setUsername(login);
        user.setDisplayName(name);
        user.setPasswordHash("не проверяется в этом тесте");
        user.setEnabled(enabled);
        users.saveAndFlush(user);
    }

    private static String тело(String login, String note) {
        return note == null
                ? "{\"login\":\"" + login + "\"}"
                : "{\"login\":\"" + login + "\",\"note\":\"" + note + "\"}";
    }

    // Пустой график — это ответ, а не отсутствие ответа: экран обязан
    // отличать «на сегодня никого не назначили» от «портал не отвечает».
    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_SALES")
    void anEmptyRosterStillAnswersWhoIsOnDutyToday() throws Exception {
        mvc.perform(get("/api/admin/v1/duty/today"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").exists())
                .andExpect(jsonPath("$.login").doesNotExist())
                .andExpect(jsonPath("$.alarm").value(false))
                // Часы работы приезжают вместе с дежурством: «никого нет»
                // без «когда бывают» читается как «здесь никого не бывает».
                .andExpect(jsonPath("$.supportHours").isNotEmpty());
    }

    @Test
    @WithMockUser(username = "boss", roles = "PORTAL_ADMIN")
    void assigningResolvesTheLoginToAName() throws Exception {
        account("fedorova", "Анна Фёдорова", true);

        mvc.perform(put("/api/admin/v1/duty/" + roster.today())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(тело("fedorova", "первый день")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.login").value("fedorova"))
                .andExpect(jsonPath("$.name").value("Анна Фёдорова"))
                .andExpect(jsonPath("$.note").value("первый день"))
                .andExpect(jsonPath("$.assignedBy").value("boss"));

        mvc.perform(get("/api/admin/v1/duty/today"))
                .andExpect(jsonPath("$.login").value("fedorova"))
                .andExpect(jsonPath("$.name").value("Анна Фёдорова"));
    }

    // Опечатка в свободной строке ничем не отличается от правильного логина,
    // и день оказывается записан на человека, которого нет. У дежурства это
    // дороже, чем у ответственного: по нему решают, кому звонить.
    @Test
    @WithMockUser(username = "boss", roles = "PORTAL_ADMIN")
    void aloginThatIsNotInTheDirectoryIsRefused() throws Exception {
        mvc.perform(put("/api/admin/v1/duty/" + roster.today())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(тело("fedorva", null)))
                .andExpect(status().isConflict());
    }

    // Отключённый сотрудник остаётся в справочнике (на нём старые сделки),
    // но дежурить не может: учётная запись выключена ровно тогда, когда
    // человек в портал больше не входит.
    @Test
    @WithMockUser(username = "boss", roles = "PORTAL_ADMIN")
    void adisabledAccountCannotBePutOnDuty() throws Exception {
        account("uvolen", "Пётр Уволенный", false);

        mvc.perform(put("/api/admin/v1/duty/" + roster.today())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(тело("uvolen", null)))
                .andExpect(status().isConflict());
    }

    @Test
    @WithMockUser(username = "boss", roles = "PORTAL_ADMIN")
    void thescheduleListsFilledDaysWithNames() throws Exception {
        account("fedorova", "Анна Фёдорова", true);
        var today = roster.today();

        mvc.perform(put("/api/admin/v1/duty/" + today.plusDays(2))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(тело("fedorova", null)))
                .andExpect(status().isOk());

        mvc.perform(get("/api/admin/v1/duty")
                        .param("from", today.toString())
                        .param("to", today.plusDays(13).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].date").value(today.plusDays(2).toString()))
                .andExpect(jsonPath("$[0].name").value("Анна Фёдорова"))
                // Присутствие осмысленно только у сегодняшнего дня: у завтрашней
                // смены «на месте» означало бы, что человек сидит в чужой день.
                .andExpect(jsonPath("$[0].atDesk").value(false));
    }

    @Test
    @WithMockUser(username = "boss", roles = "PORTAL_ADMIN")
    void releasingADayEmptiesIt() throws Exception {
        account("fedorova", "Анна Фёдорова", true);
        var today = roster.today();

        mvc.perform(put("/api/admin/v1/duty/" + today)
                .contentType(MediaType.APPLICATION_JSON)
                .content(тело("fedorova", null)));

        mvc.perform(delete("/api/admin/v1/duty/" + today))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/admin/v1/duty/today"))
                .andExpect(jsonPath("$.login").doesNotExist());
    }

    // Передача смены — действие продаж, а не администратора: спрашивать
    // на неё администратора значит остановить передачу до понедельника.
    @Test
    @WithMockUser(username = "fedorova", roles = "PORTAL_SALES")
    void asalespersonHandsTheShiftOverWithoutAnAdmin() throws Exception {
        account("fedorova", "Анна Фёдорова", true);
        account("petrov", "Иван Петров", true);

        mvc.perform(put("/api/admin/v1/duty/" + roster.today())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(тело("fedorova", null)))
                .andExpect(status().isOk());

        mvc.perform(post("/api/admin/v1/duty/handoff")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(тело("petrov", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.login").value("petrov"))
                .andExpect(jsonPath("$.assignedBy").value("fedorova"));
    }

    // Передавать нечего, если на сегодня никого не ставили: это назначение,
    // а не передача.
    @Test
    @WithMockUser(username = "fedorova", roles = "PORTAL_SALES")
    void handingOverAnEmptyDayIsRefused() throws Exception {
        account("petrov", "Иван Петров", true);

        mvc.perform(post("/api/admin/v1/duty/handoff")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(тело("petrov", null)))
                .andExpect(status().isConflict());
    }

    // Тот, кто ведёт сайт, в закрытом контуре не бывает вовсе — и дежурство
    // не исключение.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_PRODUCTION")
    void thesiteEditorDoesNotSeeTheRoster() throws Exception {
        mvc.perform(get("/api/admin/v1/duty")).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/v1/duty/today")).andExpect(status().isForbidden());
    }
}
