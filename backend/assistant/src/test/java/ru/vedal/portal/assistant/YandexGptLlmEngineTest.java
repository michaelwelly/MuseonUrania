package ru.vedal.portal.assistant;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import ru.vedal.portal.catalog.CatalogQuery;
import ru.vedal.portal.catalog.PublicDto;
import ru.vedal.portal.content.ContentQuery;
import ru.vedal.portal.documents.DocumentQuery;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class YandexGptLlmEngineTest {

    private static final String ENDPOINT = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";

    @Test
    void asksYandexGptOnlyAfterLocalSourcesWereFound() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var engine = engine(builder, true);

        server.expect(requestTo(ENDPOINT))
                .andExpect(header("Authorization", "Api-Key test-key"))
                .andExpect(content().string(containsString("gpt://folder/yandexgpt/latest")))
                .andExpect(content().string(containsString("VEDAL A-2000")))
                .andRespond(withSuccess("""
                        {
                          "result": {
                            "alternatives": [
                              {
                                "message": {
                                  "role": "assistant",
                                  "text": "По вашему запросу подходит VEDAL A-2000. Подробности есть на странице изделия."
                                },
                                "status": "ALTERNATIVE_STATUS_FINAL"
                              }
                            ]
                          }
                        }
                        """, MediaType.APPLICATION_JSON));

        var answer = engine.answer("нужен инкубатор", LlmEngine.Scope.PUBLIC).orElseThrow();

        assertThat(answer.text()).contains("VEDAL A-2000");
        assertThat(answer.sources()).singleElement()
                .extracting(LlmEngine.Source::url)
                .isEqualTo("/products/vedal-a-2000/");
        server.verify();
    }

    @Test
    void fallsBackToLocalGroundedAnswerWhenYandexGptFails() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var engine = engine(builder, true);

        server.expect(requestTo(ENDPOINT)).andRespond(withServerError());

        var answer = engine.answer("нужен инкубатор", LlmEngine.Scope.PUBLIC).orElseThrow();

        assertThat(answer.text()).contains("Вот что подходит");
        assertThat(answer.sources()).singleElement()
                .extracting(LlmEngine.Source::title)
                .asString()
                .contains("VEDAL A-2000");
        server.verify();
    }

    @Test
    void returnsEmptyWithoutCallingYandexWhenRetrievalHasNoSources() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var engine = engine(builder, true);

        assertThat(engine.answer("погода завтра", LlmEngine.Scope.PUBLIC)).isEmpty();
        server.verify();
    }

    private static YandexGptLlmEngine engine(RestClient.Builder builder, boolean fallback) {
        return new YandexGptLlmEngine(retrieval(), builder, ENDPOINT,
                "gpt://folder/yandexgpt/latest", "test-key", 0.2, 600, fallback);
    }

    private static DeterministicSearch retrieval() {
        return new DeterministicSearch(new CatalogQuery() {
            @Override
            public List<PublicDto.CategoryView> categories() {
                return List.of();
            }

            @Override
            public List<PublicDto.Card> publishedProducts() {
                return List.of(new PublicDto.Card(
                        "vedal-a-2000",
                        "VEDAL A-2000",
                        "Инкубатор-трансформер",
                        "Оборудование для выхаживания новорождённых.",
                        "pending",
                        List.of("Неонатология"),
                        null,
                        null));
            }

            @Override
            public PublicDto.Detail publishedProduct(String slug) {
                return null;
            }
        }, new ContentQuery() {
            @Override
            public List<Card> publishedNews() {
                return List.of();
            }

            @Override
            public Article publishedArticle(String slug) {
                return null;
            }
        }, new DocumentQuery() {
            @Override
            public List<Card> listedDocuments() {
                return List.of();
            }

            @Override
            public List<Card> staffDocuments() {
                return List.of();
            }

            @Override
            public Optional<Ref> ref(UUID id) {
                return Optional.empty();
            }

            @Override
            public List<Ref> refs(Collection<UUID> ids) {
                return List.of();
            }

            @Override
            public Download download(String slug) {
                return null;
            }
        });
    }
}
