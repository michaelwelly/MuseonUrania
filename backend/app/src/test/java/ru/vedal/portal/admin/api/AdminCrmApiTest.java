package ru.vedal.portal.admin.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.audit.AuditEntryRepository;
import ru.vedal.portal.common.OutboxRepository;
import ru.vedal.portal.crm.LeadIntake;
import ru.vedal.portal.crm.LeadRepository;
import ru.vedal.portal.documents.DocumentRepository;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Клиенты, сделки, вложения и история.
//
// Заявки здесь заводятся через доменную дверь LeadIntake, а не через
// `POST /api/forms/v1/leads`: у формы лимит частоты в пять обращений
// на процесс, счётчик держится в памяти и откатом транзакции не убирается —
// тест, отправивший шестую заявку, уронил бы соседний класс, а не себя.
@AutoConfigureMockMvc
class AdminCrmApiTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Autowired
    LeadIntake intake;

    @Autowired
    LeadRepository leads;

    @Autowired
    DocumentRepository documents;

    @Autowired
    OutboxRepository outbox;

    @Autowired
    AuditEntryRepository audit;

    @Autowired
    ObjectMapper json;

    @Test
    void anonymousIsRefusedWithoutBeingSentToALoginPage() throws Exception {
        mvc.perform(get("/api/admin/v1/clients")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/v1/deals")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "outsider", roles = "SOMETHING_ELSE")
    void authenticatedWithoutPortalRoleSeesNoClientBase() throws Exception {
        mvc.perform(get("/api/admin/v1/clients")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void pipelinesCarryTheirOwnStages() throws Exception {
        mvc.perform(get("/api/admin/v1/deals/pipelines"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.pipeline == 'sales')].stages[4]").value("lost"))
                .andExpect(jsonPath("$[?(@.pipeline == 'service')].stages[1]").value("diagnostics"))
                // Чем воронка заканчивается, справочник говорит сам: список
                // исходов, переписанный в форму, разъедется с доменом молча.
                .andExpect(jsonPath("$[?(@.pipeline == 'sales')].wonStages[0]").value("won"))
                .andExpect(jsonPath("$[?(@.pipeline == 'sales')].lostStages[0]").value("lost"))
                .andExpect(jsonPath("$[?(@.pipeline == 'dealer')].wonStages[0]").value("active"))
                .andExpect(jsonPath("$[?(@.pipeline == 'service')].lostStages[0]").value("declined"))
                // Чужой исход в списке — стадия, которую форма предложит,
                // а портал и ограничение схемы тут же откажутся принять.
                .andExpect(jsonPath("$[?(@.pipeline == 'sales')].wonStages[1]").doesNotExist());
    }

    // Заявка разбирается в клиента и сделку. Карточка клиента заводится
    // из данных заявки: телефон и почта уже есть, перебивать их руками —
    // способ ошибиться в цифре.
    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void leadBecomesClientAndDeal() throws Exception {
        var leadId = acceptLead("crm-convert-1", "ГКБ №1", "ru", "innoprom-2026");

        var deal = mvc.perform(post("/api/admin/v1/leads/" + leadId + "/convert")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pipeline\":\"sales\",\"amount\":1250000.00}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pipeline").value("sales"))
                .andExpect(jsonPath("$.stage").value("new"))
                .andExpect(jsonPath("$.clientName").value("ГКБ №1"))
                .andExpect(jsonPath("$.leadId").value(leadId.toString()))
                // Название сделки собирается из формы заявки и изделия.
                .andExpect(jsonPath("$.title").value("Запрос цены — vedal-r1"))
                .andReturn().getResponse().getContentAsString();

        assertThat(id(deal)).isNotBlank();

        // Разобранная заявка больше не черновик: оставить её в списке
        // «разобрать» значит разобрать её второй раз.
        assertThat(leads.findById(leadId).orElseThrow().getStatus()).isEqualTo("in_progress");

        mvc.perform(get("/api/admin/v1/leads/" + leadId))
                .andExpect(jsonPath("$.dealId").value(id(deal)))
                .andExpect(jsonPath("$.language").value("ru"))
                .andExpect(jsonPath("$.campaign").value("innoprom-2026"));
    }

    // Клиент из заявки без организации — человек, а не безымянная компания.
    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void leadWithoutCompanyBecomesAPerson() throws Exception {
        var leadId = acceptLead("crm-convert-person", null, "ru", null);

        var deal = mvc.perform(post("/api/admin/v1/leads/" + leadId + "/convert")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pipeline\":\"service\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.clientName").value("Иван Петров"))
                .andExpect(jsonPath("$.stage").value("new"))
                .andReturn().getResponse().getContentAsString();

        mvc.perform(get("/api/admin/v1/clients/" + field(deal, "clientId")))
                .andExpect(jsonPath("$.kind").value("person"))
                .andExpect(jsonPath("$.phone").value("+7 343 555-22-11"));
    }

    // Двойное нажатие «завести сделку» не должно порождать две сделки
    // по одному обращению: обе попали бы в аналитику.
    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void leadIsConvertedOnlyOnce() throws Exception {
        var leadId = acceptLead("crm-convert-2", "ГКБ №2", "ru", null);

        mvc.perform(post("/api/admin/v1/leads/" + leadId + "/convert")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pipeline\":\"sales\"}"))
                .andExpect(status().isCreated());

        mvc.perform(post("/api/admin/v1/leads/" + leadId + "/convert")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pipeline\":\"sales\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(containsString("уже разобрана")));
    }

    // Событие о сделке уезжает в топик, то есть за пределы карточки. Ни имени
    // клиента, ни контактов, ни суммы там быть не должно.
    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void dealEventCarriesNeitherPersonalDataNorMoney() throws Exception {
        outbox.deleteAll();
        var leadId = acceptLead("crm-event-1", "Перинатальный центр", "ru", null);

        mvc.perform(post("/api/admin/v1/leads/" + leadId + "/convert")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pipeline\":\"sales\",\"amount\":990000.00}"))
                .andExpect(status().isCreated());

        assertThat(outbox.findAll())
                .filteredOn(e -> "vedal.deals.v1".equals(e.getType()))
                .as("сделка порождает событие в своём топике")
                .singleElement()
                .satisfies(e -> {
                    assertThat(e.getAggregate()).isEqualTo("deal");
                    assertThat(e.getPayload())
                            .doesNotContain("Перинатальный центр")
                            .doesNotContain("ivan@example.ru")
                            .doesNotContain("990000")
                            .contains("sales");
                });
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void closingADealStampsTheDateAndReopeningClearsIt() throws Exception {
        var dealId = dealFromLead("crm-stage-1", "sales");

        mvc.perform(post("/api/admin/v1/deals/" + dealId + "/stage")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"stage\":\"won\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stage").value("won"))
                .andExpect(jsonPath("$.closedAt").exists());

        // Ошибаются и здесь. Вернуть сделку в работу можно, и тогда отметка
        // о закрытии обязана сняться — иначе сделка открыта, а закрыта вчера.
        mvc.perform(post("/api/admin/v1/deals/" + dealId + "/stage")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"stage\":\"qualified\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.closedAt").doesNotExist());
    }

    // Причину проигрыша форма спрашивает до нажатия, а не после отказа —
    // значит, ей надо знать, какая стадия проигрышная. Знание приезжает
    // в карточке вместе со списком стадий: у сервисной воронки исходы
    // зовутся иначе, чем у продаж, и переписанный в интерфейс список
    // ошибся бы ровно здесь.
    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void dealCardNamesTheStagesThatEndItsPipeline() throws Exception {
        var dealId = dealFromLead("crm-stage-outcomes", "service");

        mvc.perform(get("/api/admin/v1/deals/" + dealId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wonStages")
                        .value(org.hamcrest.Matchers.contains("closed")))
                .andExpect(jsonPath("$.lostStages")
                        .value(org.hamcrest.Matchers.contains("declined")));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void lostDealDemandsAReason() throws Exception {
        var dealId = dealFromLead("crm-stage-2", "sales");

        mvc.perform(post("/api/admin/v1/deals/" + dealId + "/stage")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"stage\":\"lost\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(containsString("причину")));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void stageFromAnotherPipelineIsRefusedWithTheAllowedList() throws Exception {
        var dealId = dealFromLead("crm-stage-3", "sales");

        mvc.perform(post("/api/admin/v1/deals/" + dealId + "/stage")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"stage\":\"diagnostics\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(containsString("не из воронки")));
    }

    // Двое открыли одну карточку клиента. Первый сохранил, второй сохраняет
    // поверх с прочитанной версией — и получает отказ, а не тихую перезапись.
    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void secondEditorCannotOverwriteClientSilently() throws Exception {
        var created = mvc.perform(post("/api/admin/v1/clients")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(clientJson("Больница на Совхозной", null, null)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        var clientId = id(created);
        var readByBoth = Long.parseLong(field(created, "version"));

        mvc.perform(put("/api/admin/v1/clients/" + clientId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(clientJson("Больница на Совхозной, корпус 1", null, readByBoth)))
                .andExpect(status().isOk());

        mvc.perform(put("/api/admin/v1/clients/" + clientId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(clientJson("Больница на Совхозной, корпус 2", null, readByBoth)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(containsString("другой редактор")));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void clientFormWithoutVersionIsRefused() throws Exception {
        var created = mvc.perform(post("/api/admin/v1/clients")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(clientJson("Клиника без версии", null, null)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        mvc.perform(put("/api/admin/v1/clients/" + id(created))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(clientJson("Клиника без версии", null, null)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(containsString("без версии")));
    }

    // ИНН — естественный ключ организации. Вторая карточка с тем же ИНН
    // разводит историю одной больницы по двум местам.
    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void clientWithTheSameInnIsRefusedByName() throws Exception {
        mvc.perform(post("/api/admin/v1/clients")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(clientJson("Первая городская", "5406826069", null)))
                .andExpect(status().isCreated());

        mvc.perform(post("/api/admin/v1/clients")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(clientJson("Первая городская (дубль)", "5406826069", null)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(containsString("Первая городская")));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void malformedInnIsRefusedAtTheField() throws Exception {
        mvc.perform(post("/api/admin/v1/clients")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(clientJson("Кривой ИНН", "12345", null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.inn").exists());
    }

    // Требование functional_requirements — «вложения из согласованных
    // документов». Несогласованный документ, уехавший клиенту, отзывается
    // уже только письмом с извинениями.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void approvedDocumentIsAttachedAndDetached() throws Exception {
        var dealId = dealFromLead("crm-attach-1", "sales");
        var documentId = approveDocument("katalog-produkcii-2026");

        mvc.perform(post("/api/admin/v1/deals/" + dealId + "/attachments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"documentId\":\"" + documentId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attachments.length()").value(1))
                .andExpect(jsonPath("$.attachments[0].slug").value("katalog-produkcii-2026"))
                .andExpect(jsonPath("$.attachments[0].attachedBy").value("editor"));

        mvc.perform(delete("/api/admin/v1/deals/" + dealId + "/attachments/" + documentId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attachments.length()").value(0));
    }

    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void sameDocumentIsNotAttachedTwice() throws Exception {
        var dealId = dealFromLead("crm-attach-2", "sales");
        var documentId = approveDocument("katalog-produkcii-2026");
        var body = "{\"documentId\":\"" + documentId + "\"}";

        mvc.perform(post("/api/admin/v1/deals/" + dealId + "/attachments")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());

        mvc.perform(post("/api/admin/v1/deals/" + dealId + "/attachments")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(containsString("уже приложен")));
    }

    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void unapprovedDocumentCannotBeAttached() throws Exception {
        var dealId = dealFromLead("crm-attach-3", "sales");
        // Ни один документ в сиде не загружен и не согласован — берём любой.
        var document = documents.findBySlug("opisanie-izdeliya-vedal-r1-r2").orElseThrow();
        assertThat(document.isPublished())
                .as("тест держится на том, что документ не согласован")
                .isFalse();

        mvc.perform(post("/api/admin/v1/deals/" + dealId + "/attachments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"documentId\":\"" + document.getId() + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(containsString("не согласован")));
    }

    // История — переписка с человеком, то есть персональные данные.
    // В журнал уходит вид записи, но не её текст.
    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void historyIsAppendedAndJournaledWithoutItsText() throws Exception {
        var dealId = dealFromLead("crm-history-1", "sales");

        mvc.perform(post("/api/admin/v1/deals/" + dealId + "/history")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"kind":"call","direction":"out",
                                 "subject":"Созвон по срокам",
                                 "body":"Договорились на поставку в марте, звонил Иванову Ивану."}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.actor").value("manager"))
                .andExpect(jsonPath("$.kind").value("call"));

        mvc.perform(get("/api/admin/v1/deals/" + dealId + "/history"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].body").value(containsString("марте")));

        assertThat(audit.findBySubjectAndSubjectIdOrderByAtDesc("deal", dealId))
                .anySatisfy(e -> assertThat(e.getAction()).isEqualTo("interaction.add"))
                .allSatisfy(e -> assertThat(e.getPayload() == null ? "" : e.getPayload())
                        .as("в журнале нет текста переписки")
                        .doesNotContain("Иванову")
                        .doesNotContain("марте"));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void emptyHistoryEntryIsRefused() throws Exception {
        var dealId = dealFromLead("crm-history-2", "sales");

        mvc.perform(post("/api/admin/v1/deals/" + dealId + "/history")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"note\",\"body\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.body").exists());
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void dealsAreFilteredByPipeline() throws Exception {
        dealFromLead("crm-filter-1", "sales");
        dealFromLead("crm-filter-2", "service");

        mvc.perform(get("/api/admin/v1/deals").param("pipeline", "service"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.pipeline == 'sales')]").doesNotExist())
                .andExpect(jsonPath("$.items[?(@.pipeline == 'service')]").exists());
    }

    // ?size=1000000 не должен превращать список клиентов в выгрузку всей
    // базы персональных данных одним запросом.
    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void clientPageSizeIsCappedFromAbove() throws Exception {
        mvc.perform(get("/api/admin/v1/clients").param("size", "1000000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(200));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void analyticsAnswersInFourDimensionsAndRefusesAFifth() throws Exception {
        mvc.perform(get("/api/admin/v1/analytics/dimensions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(org.hamcrest.Matchers.contains(
                        "product", "source", "language", "campaign")));

        mvc.perform(get("/api/admin/v1/analytics").param("by", "source"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.by").value("source"))
                .andExpect(jsonPath("$.rows").isArray())
                .andExpect(jsonPath("$.totals").exists());

        mvc.perform(get("/api/admin/v1/analytics").param("by", "manager"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(containsString("Неизвестный разрез")));
    }

    // --- вспомогательное -------------------------------------------------

    private UUID acceptLead(String key, String company, String language, String campaign) {
        return intake.accept(new LeadIntake.Draft("quote", "Иван Петров", company,
                "+7 343 555-22-11", "ivan@example.ru", "vedal-r1", null,
                "Прошу коммерческое предложение на две системы.", "site",
                language, campaign), key).id();
    }

    private String dealFromLead(String key, String pipeline) throws Exception {
        var leadId = acceptLead(key, "Клиника " + key, "ru", null);
        var body = mvc.perform(post("/api/admin/v1/leads/" + leadId + "/convert")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pipeline\":\"" + pipeline + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return id(body);
    }

    /** Загружает файл и публикует документ — то же, что делает редактор. */
    private String approveDocument(String slug) throws Exception {
        var document = documents.findBySlug(slug).orElseThrow();
        var pdf = new MockMultipartFile("file", slug + ".pdf", "application/pdf",
                "%PDF-1.7 проба".getBytes(StandardCharsets.UTF_8));

        mvc.perform(multipart("/api/admin/v1/documents/" + document.getId() + "/file").file(pdf))
                .andExpect(status().isOk());
        mvc.perform(post("/api/admin/v1/documents/" + document.getId() + "/publish"))
                .andExpect(status().isOk());
        return document.getId().toString();
    }

    private static String clientJson(String name, String inn, Long version) {
        return """
                {"version":%s,"name":"%s","kind":"company","inn":%s,"kpp":null,
                 "externalId":null,"country":"Россия","city":"Екатеринбург",
                 "email":"info@example.ru","phone":"+7 343 300-00-00","note":null,"owner":"manager"}
                """.formatted(version == null ? "null" : version.toString(), name,
                inn == null ? "null" : "\"" + inn + "\"");
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
