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
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
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

    @jakarta.persistence.PersistenceContext
    jakarta.persistence.EntityManager entityManager;

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

    // Снимок в строке списка.
    //
    // Изделие без снимка выглядит на сайте пустой рамкой, и редактор должен
    // видеть такие списком, а не открывая каждое из тринадцати. Поле лежит
    // в строке рядом с docStatus по той же причине: строка списка несёт то,
    // по чему список читают.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void listCarriesTheImageSoMissingPhotosAreVisibleWithoutOpening() throws Exception {
        mvc.perform(post("/api/admin/v1/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson("with-photo").replace("\"imageSrc\":null",
                                "\"imageSrc\":\"photos/products/proba.jpg\"")))
                .andExpect(status().isCreated());

        mvc.perform(post("/api/admin/v1/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson("without-photo")))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/admin/v1/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.slug == 'with-photo')].imageSrc")
                        .value("photos/products/proba.jpg"))
                // Отсутствие снимка — это состояние, а не пропуск поля:
                // строка обязана прийти со снимком null, иначе интерфейс
                // не отличит «нет снимка» от «поле забыли положить».
                .andExpect(jsonPath("$[?(@.slug == 'without-photo')].imageSrc",
                        contains(nullValue())));
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
        var product = products.findBySlugAndPublishedTrue("vedal-r1").orElseThrow();

        mvc.perform(put("/api/admin/v1/products/" + product.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson("vedal-r1-new", product.getVersion())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value(org.hamcrest.Matchers.containsString("переименовать")));
    }

    // Правка изделия, у которого уже есть характеристики, заменяет их список
    // целиком. Отдельный тест, потому что путь замены раньше не был покрыт
    // ни одним: он падал пятисотой на попытке отвязать строку характеристики
    // от изделия, а колонка объявлена not null.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void productWithExistingSpecsCanBeEdited() throws Exception {
        var product = products.findAllByOrderBySortOrderAscNameAsc().stream()
                .filter(p -> !p.getSpecs().isEmpty())
                .findFirst()
                .orElseThrow(() -> new AssertionError("в сиде нет изделия с характеристиками"));

        mvc.perform(put("/api/admin/v1/products/" + product.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"version":%d,"slug":"%s","name":"Проба","kind":"Инкубатор",
                                 "summary":"Короткое описание","detail":null,"docStatus":"pending",
                                 "sortOrder":1,"imageSrc":null,"imageAlt":null,"categorySlugs":[],
                                 "keyParams":[{"label":"Масса","value":"12 кг","muted":false}],
                                 "specs":[{"label":"Питание","value":"220 В","muted":false}]}
                                """.formatted(product.getVersion(), product.getSlug())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keyParams.length()").value(1))
                .andExpect(jsonPath("$.keyParams[0].label").value("Масса"))
                .andExpect(jsonPath("$.specs.length()").value(1));

        entityManager.flush();
        entityManager.clear();

        assertThat(products.findById(product.getId()).orElseThrow().getSpecs())
                .as("старые характеристики удалены, а не отвязаны")
                .hasSize(2);
    }

    // Двое открыли одну карточку. Первый сохранил, второй сохраняет поверх
    // с той версией, которую прочитал, — и получает отказ вместо тихой
    // перезаписи чужой правки.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void secondEditorCannotOverwriteTheFirstSilently() throws Exception {
        var product = products.findAllByOrderBySortOrderAscNameAsc().getFirst();
        var readByBoth = product.getVersion();

        mvc.perform(put("/api/admin/v1/products/" + product.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson(product.getSlug(), readByBoth)))
                .andExpect(status().isOk());

        mvc.perform(put("/api/admin/v1/products/" + product.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson(product.getSlug(), readByBoth)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title")
                        .value(org.hamcrest.Matchers.containsString("другой редактор")));
    }

    // Форма без версии — это клиент, который не прочитал карточку перед
    // правкой. Сохранить её значит затереть вслепую.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void formWithoutVersionIsRefused() throws Exception {
        var product = products.findAllByOrderBySortOrderAscNameAsc().getFirst();

        mvc.perform(put("/api/admin/v1/products/" + product.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson(product.getSlug())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title")
                        .value(org.hamcrest.Matchers.containsString("без версии")));
    }

    // Изделие, на которое ссылаются документы, обязано переименовываться:
    // ссылка едет за ним каскадом, а не отбивает правку внешним ключом.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void unpublishedProductWithDocumentsCanBeRenamed() throws Exception {
        var product = products.findBySlugAndPublishedTrue("vedal-r1").orElseThrow();
        assertThat(documents.findAll())
                .as("на это изделие должны ссылаться документы, иначе тест ничего не проверяет")
                .anySatisfy(d -> assertThat(d.getProductSlug()).isEqualTo("vedal-r1"));

        mvc.perform(post("/api/admin/v1/products/" + product.getId() + "/unpublish"))
                .andExpect(status().isOk());

        var current = products.findById(product.getId()).orElseThrow();
        mvc.perform(put("/api/admin/v1/products/" + current.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson("vedal-r1-renamed", current.getVersion())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("vedal-r1-renamed"));

        // Каскад отрабатывает в базе, а не в Hibernate: без очистки контекста
        // мы читали бы те же управляемые объекты со старым значением и видели
        // бы прошлое. Тест проверяет базу, поэтому контекст надо сбросить.
        entityManager.flush();
        entityManager.clear();

        assertThat(documents.findAll())
                .as("ссылка документа поехала за изделием")
                .anySatisfy(d -> assertThat(d.getProductSlug()).isEqualTo("vedal-r1-renamed"));
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
        // Документ из сида стоит в перечне, а закрытому там не место
        // (document_listed_only_public, V21): снимаем отметку вместе
        // с понижением уровня, иначе не сохранится сама подготовка теста.
        document.setListed(false);
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

    /** Форма без версии — как её отправил бы клиент, не прочитавший карточку. */
    private static String productJson(String slug) {
        return productJson(slug, null);
    }

    private static String productJson(String slug, Long version) {
        return """
                {"version":%s,"slug":"%s","name":"Проба","kind":"Инкубатор","summary":"Короткое описание",
                 "detail":null,"docStatus":"pending","sortOrder":99,"imageSrc":null,"imageAlt":null,
                 "categorySlugs":[],"keyParams":[],"specs":[]}
                """.formatted(version == null ? "null" : version.toString(), slug);
    }
}
