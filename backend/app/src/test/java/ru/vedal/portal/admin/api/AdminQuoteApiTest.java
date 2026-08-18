package ru.vedal.portal.admin.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.common.OutboxRepository;
import ru.vedal.portal.crm.LeadIntake;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Воронка коммерческих предложений.
@AutoConfigureMockMvc
class AdminQuoteApiTest extends PostgresTestBase {

    private static final String TWO_ITEMS = """
            [{"productSlug":"vedal-r1","name":"Реанимационная система VEDAL R2",
              "quantity":2,"unitPrice":1250000.00},
             {"productSlug":null,"name":"Монтаж и обучение","quantity":1,"unitPrice":150000.00}]
            """;

    @Autowired
    MockMvc mvc;

    @Autowired
    LeadIntake intake;

    @Autowired
    OutboxRepository outbox;

    @Autowired
    ObjectMapper json;

    // Сумму считает портал, а не форма: браузер, приславший свой итог,
    // однажды пришлёт неверный, и клиент получит КП, в котором строки
    // не сходятся с итогом.
    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void totalIsCountedFromItems() throws Exception {
        var dealId = deal("quote-total");

        mvc.perform(post("/api/admin/v1/quotes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(newQuote(dealId, TWO_ITEMS)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("draft"))
                .andExpect(jsonPath("$.number").value(containsString("КП-")))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].amount").value(2500000.00))
                .andExpect(jsonPath("$.total").value(2650000.00));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void quotesOfTheSameDealGetDifferentNumbers() throws Exception {
        var dealId = deal("quote-numbers");

        var first = field(create(dealId, TWO_ITEMS), "number");
        var second = field(create(dealId, TWO_ITEMS), "number");

        assertThat(first).isNotEqualTo(second);

        mvc.perform(get("/api/admin/v1/deals/" + dealId + "/quotes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void sendingStampsTheDateAndFreezesTheQuote() throws Exception {
        var quote = create(deal("quote-send"), TWO_ITEMS);
        var quoteId = id(quote);

        mvc.perform(post("/api/admin/v1/quotes/" + quoteId + "/send"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("sent"))
                .andExpect(jsonPath("$.sentAt").exists());

        // Отправленное КП уже лежит у клиента в почте. Правка задним числом
        // означала бы, что портал и клиент держат разные версии одного
        // предложения и спорят, чья настоящая.
        mvc.perform(put("/api/admin/v1/quotes/" + quoteId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"version":1,"currency":"RUB","validUntil":null,"note":null,
                                 "items":[{"productSlug":null,"name":"Другая цена",
                                           "quantity":1,"unitPrice":1.00}]}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(containsString("отправлено")));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void emptyQuoteIsNotSent() throws Exception {
        var quote = create(deal("quote-empty"), "[]");

        mvc.perform(post("/api/admin/v1/quotes/" + id(quote) + "/send"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(containsString("ни одной позиции")));
    }

    // Срок «до вчера» у только что отправленного КП — опечатка, и клиент
    // увидит её раньше нас.
    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void expiredQuoteIsNotSent() throws Exception {
        var quote = mvc.perform(post("/api/admin/v1/quotes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"dealId":"%s","currency":"RUB","validUntil":"2020-01-01",
                                 "note":null,"items":%s}
                                """.formatted(deal("quote-expired"), TWO_ITEMS)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        mvc.perform(post("/api/admin/v1/quotes/" + id(quote) + "/send"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(containsString("Срок действия")));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void decisionIsAcceptedOnlyForASentQuote() throws Exception {
        var quote = create(deal("quote-decision"), TWO_ITEMS);

        mvc.perform(post("/api/admin/v1/quotes/" + id(quote) + "/decision")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"accepted\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(containsString("не получал")));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void acceptedQuoteRecordsItsDecisionAndEvent() throws Exception {
        outbox.deleteAll();
        var quoteId = id(create(deal("quote-accept"), TWO_ITEMS));

        mvc.perform(post("/api/admin/v1/quotes/" + quoteId + "/send"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/admin/v1/quotes/" + quoteId + "/decision")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"accepted\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("accepted"))
                .andExpect(jsonPath("$.decidedAt").exists());

        // Принятое КП не двигает сделку само: воронка — это то, что менеджер
        // утверждает про сделку, а не побочный эффект нажатия в соседней
        // карточке.
        assertThat(outbox.findAll())
                .filteredOn(e -> "quote".equals(e.getAggregate()))
                .extracting(e -> e.getPayload())
                .anySatisfy(p -> assertThat(p).contains("quote.sent"))
                .anySatisfy(p -> assertThat(p).contains("quote.accepted"));
    }

    // Правка отправляется вместе с версией прочитанной карточки: двое,
    // открывшие одно КП, не затирают правки друг друга молча.
    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void quoteFormWithoutVersionIsRefused() throws Exception {
        var quoteId = id(create(deal("quote-version"), TWO_ITEMS));

        mvc.perform(put("/api/admin/v1/quotes/" + quoteId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"version":null,"currency":"RUB","validUntil":null,"note":null,
                                 "items":%s}
                                """.formatted(TWO_ITEMS)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(containsString("без версии")));
    }

    // Позиции заменяются целиком: редактор видит их одним списком и удаляет
    // строку удалением строки.
    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void itemsAreReplacedWholesaleAndTotalFollows() throws Exception {
        var quote = create(deal("quote-replace"), TWO_ITEMS);

        mvc.perform(put("/api/admin/v1/quotes/" + id(quote))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"version":%s,"currency":"RUB","validUntil":null,"note":"Пересчёт",
                                 "items":[{"productSlug":null,"name":"Одна позиция",
                                           "quantity":3,"unitPrice":1000.00}]}
                                """.formatted(field(quote, "version"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.total").value(3000.00));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void quoteWithoutItemsCannotBeSavedByTheForm() throws Exception {
        var quote = create(deal("quote-noitems"), TWO_ITEMS);

        mvc.perform(put("/api/admin/v1/quotes/" + id(quote))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"version":%s,"currency":"RUB","validUntil":null,"note":null,
                                 "items":[]}
                                """.formatted(field(quote, "version"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.items").exists());
    }

    // --- вспомогательное -------------------------------------------------

    private String deal(String key) throws Exception {
        var leadId = intake.accept(new LeadIntake.Draft("quote", "Иван Петров", "Клиника " + key,
                "+7 343 555-22-11", "ivan@example.ru", "vedal-r1",
                "Прошу коммерческое предложение.", "site", "ru", null), key).id();

        var body = mvc.perform(post("/api/admin/v1/leads/" + leadId + "/convert")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pipeline\":\"sales\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return id(body);
    }

    private String create(String dealId, String items) throws Exception {
        return mvc.perform(post("/api/admin/v1/quotes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(newQuote(dealId, items)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
    }

    private static String newQuote(String dealId, String items) {
        return """
                {"dealId":"%s","currency":"RUB","validUntil":null,"note":null,"items":%s}
                """.formatted(dealId, items);
    }

    @SuppressWarnings("unchecked")
    private String id(String body) {
        return ((Map<String, Object>) json.readValue(body, Map.class)).get("id").toString();
    }

    @SuppressWarnings("unchecked")
    private String field(String body, String name) {
        return ((Map<String, Object>) json.readValue(body, Map.class)).get(name).toString();
    }
}
