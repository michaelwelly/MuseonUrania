package ru.vedal.portal.app;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import ru.vedal.portal.PostgresTestBase;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Спецификация собирается из аннотаций, поэтому проверять её надо не на то,
// что она есть, а на то, что она описывает ровно те двери, которые в коде.
// Иначе новый эндпоинт появится, а интегратор о нём не узнает.
@AutoConfigureMockMvc
class OpenApiDocsTest extends PostgresTestBase {

    private static final String SPEC = "/v3/api-docs/vedal-public";

    @Autowired
    MockMvc mvc;

    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    RequestMappingHandlerMapping mappings;

    // Именно управляемый Spring ObjectMapper: в Boot 4 это Jackson 3
    // (tools.jackson), а Jackson 2 на classpath приезжает со swagger-core
    // для его собственной сериализации.
    @Autowired
    ObjectMapper json;

    @Test
    void documentsEveryPublicDoor() throws Exception {
        assertThat(documentedPaths()).isEqualTo(new TreeSet<>(Set.of(
                "/api/public/v1/categories",
                "/api/public/v1/products",
                "/api/public/v1/products/{slug}",
                "/api/public/v1/news",
                "/api/public/v1/news/{slug}",
                "/api/public/v1/documents",
                "/api/public/v1/documents/{slug}/file",
                "/api/forms/v1/leads",
                "/api/assistant/v1/ask")));
    }

    // Тот же список, но собранный из настоящих маршрутов приложения: список выше
    // мог бы устареть вместе со спецификацией, если сверять только их друг с другом.
    @Test
    void documentedPathsMatchRegisteredRoutes() throws Exception {
        var registered = mappings.getHandlerMethods().keySet().stream()
                .filter(info -> info.getPathPatternsCondition() != null)
                .flatMap(info -> info.getPathPatternsCondition().getPatternValues().stream())
                .filter(path -> path.startsWith("/api/"))
                .collect(Collectors.toCollection(TreeSet::new));

        assertThat(registered).isNotEmpty();
        assertThat(documentedPaths()).isEqualTo(registered);
    }

    // Группа ограничена /api/**: служебный /error — обработчик Spring, а не дверь
    // портала, и в контракте для интеграции ему не место.
    @Test
    void keepsServiceHandlersOutOfTheContract() throws Exception {
        assertThat(documentedPaths())
                .noneMatch(path -> path.startsWith("/error"))
                .noneMatch(path -> path.startsWith("/admin"))
                .noneMatch(path -> path.startsWith("/actuator"));
    }

    // Спецификацию забирают не только браузером: YAML удобнее читать глазами
    // и класть в задачу. Путь у него отдельным сегментом (/v3/api-docs.yaml),
    // и под правило доступа для /v3/api-docs/** он не подходит — без
    // отдельного разрешения запрос уезжает на форму входа.
    @Test
    void servesSpecAsYamlToo() throws Exception {
        var yaml = mvc.perform(get("/v3/api-docs.yaml/vedal-public"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(yaml).startsWith("openapi:")
                .contains("/api/forms/v1/leads:")
                .contains("LeadSubmission:");
    }

    @Test
    void describesLeadFormFieldsAndConstraints() throws Exception {
        var form = map(schemas().get("LeadSubmission"));

        assertThat(list(form.get("required")))
                .containsExactlyInAnyOrder("form", "name", "phone", "email", "message", "consent");

        var fields = map(form.get("properties"));
        assertThat(list(map(fields.get("form")).get("enum")))
                .containsExactly("quote", "catalog", "consultation", "service", "partner");

        // Ловушка для ботов описана как поле, которое приходит пустым: без этого
        // интегратор заполнит её «на всякий случай» и получит отказ.
        assertThat(map(fields.get("trap")).get("description").toString())
                .contains("Ловушка для ботов");

        assertThat(map(fields.get("message")).get("minLength")).isEqualTo(10);
    }

    @Test
    void describesEntitiesBehindEveryDoor() throws Exception {
        var schemas = schemas();

        assertThat(schemas.keySet()).containsAll(List.of(
                "Category", "Spec", "ProductCard", "ProductDetail",
                "NewsCard", "NewsArticle", "DocumentCard",
                "LeadSubmission", "LeadAccepted",
                "AskRequest", "AskReply", "Handoff", "Source",
                "ProblemDetail"));

        // Поля описаны, а не просто названы: пустая схема в спецификации
        // бесполезнее её отсутствия — по ней нельзя интегрироваться.
        assertThat(property(schemas, "ProductCard", "docStatus").get("description").toString())
                .isNotBlank();
        assertThat(property(schemas, "DocumentCard", "fileUrl").get("description").toString())
                .contains("опубликованных");
    }

    // Ошибки во всех дверях — RFC 9457. Разбор по полям приезжает в расширении
    // fields, и форма на сайте рассчитывает именно на него.
    @Test
    void describesErrorContract() throws Exception {
        var problem = map(schemas().get("ProblemDetail"));
        assertThat(map(problem.get("properties")).keySet()).contains("title", "status", "fields");

        var leads = map(map(paths().get("/api/forms/v1/leads")).get("post"));
        var responses = map(leads.get("responses"));
        assertThat(responses.keySet()).contains("202", "400", "429");
        assertThat(map(map(responses.get("400")).get("content")).keySet())
                .contains("application/problem+json");
    }

    private TreeSet<String> documentedPaths() throws Exception {
        return new TreeSet<>(paths().keySet());
    }

    private Map<String, Object> paths() throws Exception {
        return map(spec().get("paths"));
    }

    private Map<String, Object> schemas() throws Exception {
        return map(map(spec().get("components")).get("schemas"));
    }

    private static Map<String, Object> property(Map<String, Object> schemas, String schema, String field) {
        return map(map(map(schemas.get(schema)).get("properties")).get(field));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object node) {
        return (Map<String, Object>) node;
    }

    @SuppressWarnings("unchecked")
    private static List<Object> list(Object node) {
        return (List<Object>) node;
    }

    private Map<String, Object> spec() throws Exception {
        var body = mvc.perform(get(SPEC))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return map(json.readValue(body, Map.class));
    }
}
