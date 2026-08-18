package ru.vedal.portal.gateway;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.common.OutboxRepository;
import ru.vedal.portal.crm.LeadRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class FormsApiTest extends PostgresTestBase {

    private static final String VALID = """
            {"form":"quote","name":"Иван Петров","company":"ГКБ №1",
             "phone":"+7 343 555-22-11","email":"ivan@example.ru",
             "productSlug":"vedal-r1",
             "message":"Прошу коммерческое предложение на две системы.","consent":true}
            """;

    @Autowired
    MockMvc mvc;

    @Autowired
    LeadRepository leads;

    @Autowired
    OutboxRepository outbox;

    @Test
    void acceptsLeadAndRecordsEventInSameTransaction() throws Exception {
        leads.deleteAll();
        outbox.deleteAll();

        mvc.perform(post("/api/forms/v1/leads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Idempotency-Key", "test-key-1")
                        .content(VALID))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.message").value("Спасибо. Специалист VEDAL свяжется с вами."));

        assertThat(leads.findAll()).hasSize(1);
        var lead = leads.findAll().getFirst();
        assertThat(lead.getStatus()).as("заявка приходит черновиком").isEqualTo("draft");
        assertThat(lead.getConsentVersion()).as("храним версию согласия, а не галочку").isNotBlank();
        assertThat(lead.getConsentAt()).isNotNull();

        assertThat(outbox.findAll())
                .as("событие коммитится вместе с заявкой")
                .singleElement()
                .satisfies(e -> assertThat(e.getType()).isEqualTo("vedal.leads.v1"));
    }

    @Test
    void repeatWithSameKeyDoesNotCreateSecondLead() throws Exception {
        leads.deleteAll();

        var first = submit("test-key-2");
        var second = submit("test-key-2");

        assertThat(second).isEqualTo(first);
        assertThat(leads.findAll()).hasSize(1);
    }

    @Test
    void invalidSubmissionNamesTheBrokenFields() throws Exception {
        mvc.perform(post("/api/forms/v1/leads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"form":"quote","name":"","phone":"123","email":"нет",
                                 "message":"мало","consent":false}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.fields.name").value("Укажите, к кому обращаться"))
                .andExpect(jsonPath("$.fields.phone").value("Укажите телефон с кодом"))
                .andExpect(jsonPath("$.fields.email").value("Проверьте адрес почты"))
                .andExpect(jsonPath("$.fields.consent").value("Без согласия отправить запрос нельзя"));
    }

    @Test
    void filledTrapIsRejectedWithoutSayingWhy() throws Exception {
        leads.deleteAll();

        mvc.perform(post("/api/forms/v1/leads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"form":"quote","name":"Бот","phone":"+7 343 555-22-11",
                                 "email":"bot@example.ru","message":"Заполнено автоматически.",
                                 "consent":true,"trap":"я бот"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Заявка не принята"));

        assertThat(leads.findAll()).as("ловушка не создаёт заявку").isEmpty();
    }

    // Атрибуция проверяется на границе доверия, как и остальные поля.
    // Проверка срабатывает до тела обработчика, поэтому лимит частоты
    // на такую заявку не тратится.
    @Test
    void languageMustBeATwoLetterCode() throws Exception {
        mvc.perform(post("/api/forms/v1/leads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID.replace("\"consent\":true",
                                "\"language\":\"russian\",\"consent\":true")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.language").value("Язык — двухбуквенный код"));
    }

    @Test
    void unknownFormTypeIsRejected() throws Exception {
        mvc.perform(post("/api/forms/v1/leads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID.replace("\"quote\"", "\"whatever\"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.form").value("Неизвестный тип формы"));
    }

    private String submit(String key) throws Exception {
        var response = mvc.perform(post("/api/forms/v1/leads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Idempotency-Key", key)
                        .content(VALID))
                .andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString();
        return response;
    }
}
