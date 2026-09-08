package ru.vedal.portal.iam;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.audit.AuditEntryRepository;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Выдача роли доходит до конца и оставляет след в журнале (issue #95).
 *
 * <p><b>Почему отдельный класс, а не проверка в StaffDirectoryTest.</b>
 * Там справочник работает в запасном режиме {@code local}, который ролями
 * не управляет: он отвергает запрос ДО того, как дело дойдёт до журнала.
 * Все прежние проверки поэтому заканчивались на 409, и успешный путь —
 * единственный, по которому ходит настоящий сисадмин с Keycloak, — не
 * выполнялся ни разу. Здесь справочник подменён принимающим.
 *
 * <p><b>Почему без транзакции.</b> {@code PostgresTestBase} объявлен
 * {@code @Transactional}, и MockMvc зовёт контроллер в том же потоке —
 * то есть в транзакции теста. Именно она и прятала беду: {@code AuditLog.record}
 * объявлен {@code MANDATORY}, транзакция теста ему подходила, и запись
 * проходила. В работе транзакции вокруг этой двери нет вовсе — изменение
 * живёт в Keycloak, а не в базе, — и {@code MANDATORY} бросал
 * {@code IllegalTransactionStateException} ПОСЛЕ выдачи роли: сисадмин
 * видел 500, роль была изменена, а в журнале её изменения не было.
 *
 * <p>{@code NOT_SUPPORTED} снимает транзакцию теста и ставит дверь
 * в те же условия, что в работе. Прибирать за собой нечего: запись журнала
 * дописывающаяся, её и нельзя было бы удалить — на таблице триггер
 * {@code audit_entry_append_only}.
 */
@AutoConfigureMockMvc
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class StaffRolesAuditTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Autowired
    AuditEntryRepository entries;

    @Autowired
    StaffDirectory staff;

    @Test
    @WithMockUser(username = "boss", roles = "PORTAL_ADMIN")
    void assigningARoleAnswersOkAndLeavesAJournalEntry() throws Exception {
        var было = entries.count();

        mvc.perform(put("/api/admin/v1/staff/fedorova/roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roles\":[\"portal-sales\"]}"))
                .andExpect(status().isOk());

        // Роль действительно выдана — иначе проверка журнала ничего
        // не значила бы: запись о несостоявшемся изменении тоже «есть».
        assertThat(((Accepting) staff).дали).containsExactly("portal-sales");

        // И само изменение прав не прошло мимо журнала. Это не украшение
        // ответа: изменение прав, которого нет в журнале, нечем объяснить
        // ни через неделю, ни на разборе.
        assertThat(entries.count()).isEqualTo(было + 1);
        assertThat(entries.findAll())
                .filteredOn(e -> "staff.roles".equals(e.getAction()))
                .extracting(e -> e.getSubjectId())
                .contains("fedorova");
    }

    /**
     * Справочник, который роли принимает.
     *
     * <p>Подменять его приходится потому, что настоящих реализаций две
     * и обе в этом тесте не годятся: {@code local} ролями не управляет
     * вовсе, а {@code keycloak} требует поднятого realm'а — цена, которую
     * платить ради проверки одной записи в журнале незачем.
     */
    @TestConfiguration
    static class Accepts {

        @Bean
        @Primary
        StaffDirectory acceptingDirectory() {
            return new Accepting();
        }
    }

    static class Accepting implements StaffDirectory {

        final List<String> дали = new ArrayList<>();

        @Override
        public List<Person> staff() {
            return List.of(new Person("fedorova", "Анна Фёдорова", true, List.copyOf(дали)));
        }

        @Override
        public void assignRoles(String login, List<String> roles) {
            дали.clear();
            дали.addAll(roles);
        }
    }
}
