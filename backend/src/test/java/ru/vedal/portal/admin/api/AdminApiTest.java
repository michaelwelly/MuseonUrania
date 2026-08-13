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
import ru.vedal.portal.catalog.ProductRepository;
import ru.vedal.portal.content.NewsRepository;
import ru.vedal.portal.documents.DocumentRepository;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class AdminApiTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Autowired
    ProductRepository products;

    @Autowired
    NewsRepository news;

    @Autowired
    DocumentRepository documents;

    @Autowired
    AuditEntryRepository audit;

    @Autowired
    ObjectMapper json;

    @Test
    void anonymousIsRefusedWithoutBeingSentToALoginPage() throws Exception {
        // Именно 401, а не редирект на форму: это API, и клиент у него —
        // не браузер, который умеет показать страницу входа.
        mvc.perform(get("/api/admin/v1/products")).andExpect(status().isUnauthorized());
    }

    // Подписанный токен без роли портала — это аутентификация без авторизации.
    // Пускать по одному факту входа значит открыть каталог всем, у кого есть
    // учётная запись в контуре.
    @Test
    @WithMockUser(username = "outsider", roles = "SOMETHING_ELSE")
    void authenticatedWithoutPortalRoleIsForbidden() throws Exception {
        mvc.perform(get("/api/admin/v1/products")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void listShowsUnpublishedProductsUnlikeThePublicDoor() throws Exception {
        // Весь сид опубликован, поэтому черновик заводим сами: проверяем
        // разницу между дверьми, а не состав сида.
        mvc.perform(post("/api/admin/v1/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson("hidden-device")))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/admin/v1/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.slug == 'hidden-device')]").exists());

        mvc.perform(get("/api/public/v1/products"))
                .andExpect(jsonPath("$[?(@.slug == 'hidden-device')]").doesNotExist());

        assertThat(products.findBySlug("hidden-device")).isPresent()
                .get().satisfies(p -> assertThat(p.isPublished()).isFalse());
    }

    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void createdProductIsInvisibleUntilPublished() throws Exception {
        var id = id(mvc.perform(post("/api/admin/v1/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson("probe-device")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.published").value(false))
                .andReturn().getResponse().getContentAsString());

        mvc.perform(get("/api/public/v1/products/probe-device")).andExpect(status().isNotFound());

        mvc.perform(post("/api/admin/v1/products/" + id + "/publish"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(true));

        mvc.perform(get("/api/public/v1/products/probe-device")).andExpect(status().isOk());
    }

    // Адрес карточки уже разослан и проиндексирован: переименование
    // опубликованного изделия оборвало бы все внешние ссылки.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void publishedProductCannotBeRenamed() throws Exception {
        var product = products.findBySlugAndPublishedTrue("vedal-r1-r2").orElseThrow();

        mvc.perform(put("/api/admin/v1/products/" + product.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson("vedal-r1-r2-new")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(org.hamcrest.Matchers.containsString("переименовать")));
    }

    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void slugMustBeLatinLowercase() throws Exception {
        mvc.perform(post("/api/admin/v1/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson("Инкубатор А-2000")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.slug").exists());
    }

    // Ограничение news_published_needs_date не даст сохранить такую строку.
    // Редактор должен увидеть причину, а не отказ базы с именем ограничения.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void newsWithoutDateCannotBePublished() throws Exception {
        var id = id(mvc.perform(post("/api/admin/v1/news")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"probe-news","tag":"Производство","title":"Проба",
                                 "excerpt":"Короткий анонс","body":null,"publishedOn":null}
                                """))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());

        mvc.perform(post("/api/admin/v1/news/" + id + "/publish"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(org.hamcrest.Matchers.containsString("даты")));
    }

    // Сервисные инструкции, конструкторская и производственная документация
    // публично не размещаются. То же правило закрыто ограничением схемы
    // document_public_only — здесь оно объясняется словами до нажатия.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void internalDocumentIsRefusedPublicationWithAReason() throws Exception {
        var document = documents.findBySlug("opisanie-izdeliya-vedal-r1-r2").orElseThrow();
        document.setSensitivity("internal");
        documents.saveAndFlush(document);

        mvc.perform(post("/api/admin/v1/documents/" + document.getId() + "/publish"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(org.hamcrest.Matchers.containsString("internal")));
    }

    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void documentListExplainsWhyPublicationIsBlocked() throws Exception {
        mvc.perform(get("/api/admin/v1/documents"))
                .andExpect(status().isOk())
                // Ни один документ в сиде не загружен, значит у всех одна
                // и та же причина: файла нет.
                .andExpect(jsonPath("$[0].publishBlockedBy")
                        .value(org.hamcrest.Matchers.containsString("Файл не загружен")));
    }

    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void uploadedFileMakesPublicationPossible() throws Exception {
        var document = documents.findBySlug("katalog-produkcii-2026").orElseThrow();
        var pdf = new MockMultipartFile("file", "katalog.pdf", "application/pdf",
                "%PDF-1.7 проба".getBytes(java.nio.charset.StandardCharsets.UTF_8));

        mvc.perform(multipart("/api/admin/v1/documents/" + document.getId() + "/file").file(pdf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasFile").value(true))
                // Загрузка не публикует: публикация — отдельное действие.
                .andExpect(jsonPath("$.published").value(false))
                .andExpect(jsonPath("$.publishBlockedBy").doesNotExist());

        mvc.perform(post("/api/admin/v1/documents/" + document.getId() + "/publish"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(true))
                .andExpect(jsonPath("$.approvedBy").value("editor"));

        mvc.perform(get("/api/public/v1/documents/katalog-produkcii-2026/file"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void leadTriageIsJournaledWithoutPersonalData() throws Exception {
        var accepted = mvc.perform(post("/api/forms/v1/leads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Idempotency-Key", "probe-admin-api")
                        .content("""
                                {"form":"quote","name":"Иванов Иван","phone":"+79222047530",
                                 "email":"ivanov@example.com","message":"Прошу коммерческое предложение",
                                 "consent":true,"trap":""}
                                """))
                .andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString();
        var leadId = id(accepted);

        mvc.perform(post("/api/admin/v1/leads/" + leadId + "/triage")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"in_progress\",\"owner\":\"manager\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("in_progress"));

        var entries = audit.findBySubjectAndSubjectIdOrderByAtDesc("lead", leadId);
        assertThat(entries).extracting(e -> e.getAction()).contains("lead.triage");
        assertThat(entries).allSatisfy(e -> {
            assertThat(e.getPayload() == null ? "" : e.getPayload())
                    .as("в журнале нет персональных данных")
                    .doesNotContain("ivanov@example.com")
                    .doesNotContain("Иванов");
        });
    }

    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void auditIsReadableByObjectAndPaged() throws Exception {
        mvc.perform(get("/api/admin/v1/audit").param("subject", "document").param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(5))
                .andExpect(jsonPath("$.items").isArray());
    }

    // На связке product_category стоит on delete restrict — база откажет сама.
    // Дверь обязана объяснить это числом изделий, а не именем внешнего ключа.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void categoryWithProductsCannotBeDeleted() throws Exception {
        var body = mvc.perform(get("/api/admin/v1/categories"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        @SuppressWarnings("unchecked")
        var categories = (List<Map<String, Object>>) json.readValue(body, List.class);
        var populated = categories.stream()
                .filter(c -> ((Number) c.get("productCount")).intValue() > 0)
                .findFirst()
                .orElseThrow();

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/api/admin/v1/categories/" + populated.get("id")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(org.hamcrest.Matchers.containsString("изделий")));
    }

    @SuppressWarnings("unchecked")
    private String id(String body) {
        return ((Map<String, Object>) json.readValue(body, Map.class)).get("id").toString();
    }

    private static String productJson(String slug) {
        return """
                {"slug":"%s","name":"Проба","kind":"Инкубатор","summary":"Короткое описание",
                 "detail":null,"docStatus":"pending","sortOrder":99,"imageSrc":null,"imageAlt":null,
                 "categorySlugs":[],"keyParams":[],"specs":[]}
                """.formatted(slug);
    }
}
