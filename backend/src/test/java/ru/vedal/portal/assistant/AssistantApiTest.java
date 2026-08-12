package ru.vedal.portal.assistant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.audit.AuditEntryRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class AssistantApiTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Autowired
    AuditEntryRepository audit;

    @Test
    void answersFromPublishedCatalogWithSources() throws Exception {
        mvc.perform(ask("нужен инкубатор для новорождённых"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sources").isNotEmpty())
                .andExpect(jsonPath("$.sources[0].url").exists())
                .andExpect(jsonPath("$.handoff").doesNotExist());
    }

    @Test
    void clinicalQuestionGetsHandoffInsteadOfAnswer() throws Exception {
        mvc.perform(ask("какой диагноз ставить и чем лечить"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sources").isEmpty())
                .andExpect(jsonPath("$.handoff.phone").isNotEmpty())
                .andExpect(jsonPath("$.handoff.email").isNotEmpty());
    }

    // Если подходящих опубликованных источников нет — ответа нет, есть
    // передача человеку. Придумывать ответ запрещено.
    @Test
    void questionOutsideTheDomainGetsHandoff() throws Exception {
        mvc.perform(ask("расскажи про погоду в Екатеринбурге завтра"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sources").isEmpty())
                .andExpect(jsonPath("$.handoff").exists());
    }

    @Test
    void emptyQuestionIsRejectedByValidation() throws Exception {
        mvc.perform(ask(""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.question").value("Напишите вопрос"));
    }

    // Текст вопроса в журнал не пишем: посетитель может указать в нём и клинику,
    // и себя. Пишем категорию исхода и число источников.
    @Test
    void askIsJournaledWithoutTheQuestionText() throws Exception {
        mvc.perform(ask("нужен инкубатор для новорождённых")).andExpect(status().isOk());

        var entries = audit.findBySubjectAndSubjectIdOrderByAtDesc("assistant", "answered");
        assertThat(entries).isNotEmpty();
        assertThat(entries.getFirst().getPayload()).contains("sources");
        assertThat(entries.getFirst().getPayload()).doesNotContain("инкубатор");
    }

    private static org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder ask(String question) {
        return post("/api/assistant/v1/ask")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"question\":\"" + question + "\"}");
    }
}
