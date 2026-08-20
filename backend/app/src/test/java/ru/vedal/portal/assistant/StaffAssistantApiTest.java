package ru.vedal.portal.assistant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.audit.AuditEntryRepository;
import ru.vedal.portal.documents.DocumentRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Ведалина в закрытом контуре. §10.3 плана: после логина ассистент ищет
 * и по внутренним документам.
 *
 * Проверяется здесь граница доступа, а не качество поиска. Поиск можно
 * чинить сколько угодно; граница — та вещь, ошибка в которой означает
 * закрытый документ, показанный тому, кому его показывать нельзя.
 *
 * Три правила, и все три проверяются с двух сторон — что видно и чего
 * не видно:
 *   1. без токена закрытая дверь не отвечает вовсе;
 *   2. сотруднику видны public и internal;
 *   3. confidential не видно никому и никогда — ни в открытом контуре,
 *      ни в закрытом (§7.4 и §12.4 плана).
 */
@AutoConfigureMockMvc
class StaffAssistantApiTest extends PostgresTestBase {

    private static final String INTERNAL_TITLE = "Регламент сервисного обслуживания";
    // Заголовок один на оба уровня, и вопрос к нему один. Так проверка
    // становится контрольной: если по нему находится документ уровня internal,
    // значит поиск этот вопрос понимает, и «не нашлось» у confidential —
    // это исключение по уровню, а не промах поиска.
    //
    // Слов про цену и диагноз здесь нет намеренно: их отклоняют ограничения
    // до поиска, и тест проходил бы, даже будь дыра открыта настежь.
    private static final String CLOSED_TITLE = "Протокол испытаний на электробезопасность";
    private static final String CLOSED_QUESTION = "протокол испытаний электробезопасность";

    @Autowired
    MockMvc mvc;

    @Autowired
    DocumentRepository documents;

    @Autowired
    AuditEntryRepository audit;

    @Test
    void staffDoorIsClosedWithoutAToken() throws Exception {
        mvc.perform(staffAsk("регламент обслуживания"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_EDITOR")
    void staffSeesInternalDocuments() throws Exception {
        seed(INTERNAL_TITLE, "internal");

        mvc.perform(staffAsk("регламент обслуживания"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sources").isNotEmpty())
                .andExpect(content().string(org.hamcrest.Matchers.containsString(INTERNAL_TITLE)));
    }

    // Тот же вопрос без токена не должен находить ничего: внутренний документ
    // существует, но открытому контуру о нём знать нечего.
    @Test
    void publicDoorDoesNotSeeInternalDocuments() throws Exception {
        seed(INTERNAL_TITLE, "internal");

        mvc.perform(publicAsk("регламент обслуживания"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString(INTERNAL_TITLE))));
    }

    // Контрольный случай к двум следующим: тот же заголовок и тот же вопрос,
    // но уровень internal. Документ обязан найтись — иначе проверки ниже
    // ничего не доказывают.
    @Test
    @WithMockUser(username = "admin", roles = "PORTAL_ADMIN")
    void theSameQuestionDoesFindTheDocumentWhenItIsInternal() throws Exception {
        seed(CLOSED_TITLE, "internal");

        mvc.perform(staffAsk(CLOSED_QUESTION))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString(CLOSED_TITLE)));
    }

    // Главное правило раздела. Confidential не индексируется вообще: логин
    // не является «отдельным разрешением», о котором говорит §7.4.
    @Test
    @WithMockUser(username = "admin", roles = "PORTAL_ADMIN")
    void confidentialIsInvisibleEvenToStaff() throws Exception {
        seed(CLOSED_TITLE, "confidential");

        mvc.perform(staffAsk(CLOSED_QUESTION))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString(CLOSED_TITLE))));
    }

    @Test
    void confidentialIsInvisibleToThePublicDoor() throws Exception {
        seed(CLOSED_TITLE, "confidential");

        mvc.perform(publicAsk(CLOSED_QUESTION))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString(CLOSED_TITLE))));
    }

    // Открытый контур продолжает работать как работал: правка не должна
    // была ничего забрать у посетителя.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_EDITOR")
    void staffStillGetsThePublishedCatalog() throws Exception {
        mvc.perform(staffAsk("нужен инкубатор для новорождённых"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sources").isNotEmpty());
    }

    // В журнале открытого контура актор — «public». У закрытого им обязан
    // быть тот, кто спросил: иначе по записи не понять, кто именно искал
    // по внутренним материалам.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_EDITOR")
    void staffAskIsJournaledUnderTheirName() throws Exception {
        mvc.perform(staffAsk("нужен инкубатор для новорождённых")).andExpect(status().isOk());

        assertThat(audit.findBySubjectAndSubjectIdOrderByAtDesc("assistant", "answered"))
                .isNotEmpty()
                .anySatisfy(entry -> assertThat(entry.getActor()).isEqualTo("editor"));
    }

    // Ограничения действуют в обоих контурах: логин не даёт права спрашивать
    // про диагнозы.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_EDITOR")
    void guardrailsApplyToStaffToo() throws Exception {
        mvc.perform(staffAsk("какой диагноз ставить и чем лечить"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sources").isEmpty())
                .andExpect(jsonPath("$.handoff").exists());
    }

    /**
     * Документ, которого нет в сиде. Он не «в перечне»: listed остаётся false,
     * иначе ограничение document_listed_only_public (V21) такую строку
     * не примет — закрытому документу в публичном перечне не место.
     */
    private void seed(String title, String sensitivity) {
        var document = new ru.vedal.portal.documents.Document();
        // Идентификатор проставляется руками: у документа он не генерируется
        // базой — слаг меняется, а id остаётся, и его задают при создании.
        document.setId(java.util.UUID.randomUUID());
        document.setSlug("probe-" + sensitivity);
        document.setTitle(title);
        document.setDocGroup("Техническая документация");
        document.setSubject("VEDAL R1");
        document.setSensitivity(sensitivity);
        document.setAccess("on_request");
        document.setListed(false);
        document.setPublished(false);
        documents.saveAndFlush(document);
    }

    private static MockHttpServletRequestBuilder staffAsk(String question) {
        return post("/api/admin/v1/assistant/ask")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"question\":\"" + question + "\"}");
    }

    private static MockHttpServletRequestBuilder publicAsk(String question) {
        return post("/api/assistant/v1/ask")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"question\":\"" + question + "\"}");
    }
}
