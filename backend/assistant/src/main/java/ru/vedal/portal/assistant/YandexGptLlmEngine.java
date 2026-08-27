package ru.vedal.portal.assistant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Optional;

/**
 * YandexGPT is used only after local retrieval selected approved sources.
 *
 * <p>The model receives no private files and no raw visitor log. Its job in the
 * first release is wording, not free research: if local retrieval finds nothing,
 * the method returns empty and the handoff flow stays exactly the same.
 */
@Primary
@Component
@ConditionalOnProperty(name = "vedal.assistant.engine", havingValue = "yandexgpt")
public class YandexGptLlmEngine implements LlmEngine {

    private static final Logger log = LoggerFactory.getLogger(YandexGptLlmEngine.class);

    private final DeterministicSearch retrieval;
    private final RestClient http;
    private final String endpoint;
    private final String modelUri;
    private final double temperature;
    private final int maxTokens;
    private final boolean fallback;

    public YandexGptLlmEngine(
            DeterministicSearch retrieval,
            RestClient.Builder http,
            @Value("${vedal.assistant.yandex.endpoint}") String endpoint,
            @Value("${vedal.assistant.yandex.model-uri}") String modelUri,
            @Value("${vedal.assistant.yandex.api-key}") String apiKey,
            @Value("${vedal.assistant.yandex.temperature:0.2}") double temperature,
            @Value("${vedal.assistant.yandex.max-tokens:600}") int maxTokens,
            @Value("${vedal.assistant.yandex.fallback:true}") boolean fallback) {

        if (modelUri == null || modelUri.isBlank()) {
            throw new IllegalStateException("VEDAL_YANDEXGPT_MODEL_URI не задан");
        }
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("VEDAL_YANDEXGPT_API_KEY не задан");
        }

        this.retrieval = retrieval;
        this.http = http.defaultHeader("Authorization", "Api-Key " + apiKey).build();
        this.endpoint = endpoint;
        this.modelUri = modelUri;
        this.temperature = temperature;
        this.maxTokens = maxTokens;
        this.fallback = fallback;
    }

    @Override
    public Optional<Grounded> answer(String question, Scope scope) {
        var grounded = retrieval.answer(question, scope);
        if (grounded.isEmpty()) return Optional.empty();

        try {
            var response = http.post()
                    .uri(endpoint)
                    .body(request(question, scope, grounded.get()))
                    .retrieve()
                    .body(YandexCompletionResponse.class);

            return generatedText(response)
                    .map(text -> new Grounded(text, grounded.get().sources()))
                    .or(() -> fallback(grounded.get(), "YandexGPT вернул пустой ответ"));
        } catch (RestClientException | IllegalStateException e) {
            return fallback(grounded.get(), "YandexGPT недоступен: " + e.getMessage());
        }
    }

    private Optional<Grounded> fallback(Grounded grounded, String reason) {
        if (!fallback) {
            log.warn(reason);
            return Optional.empty();
        }
        log.warn("{}; отдаём локальный ответ по согласованным источникам", reason);
        return Optional.of(grounded);
    }

    private YandexCompletionRequest request(String question, Scope scope, Grounded grounded) {
        return new YandexCompletionRequest(
                modelUri,
                new CompletionOptions(false, temperature, Integer.toString(maxTokens)),
                List.of(
                        new Message("system", systemPrompt(scope)),
                        new Message("user", userPrompt(question, grounded))));
    }

    private static String systemPrompt(Scope scope) {
        var visibility = scope == Scope.PUBLIC
                ? "Публичный режим: отвечай только по открытым материалам сайта."
                : "Закрытый режим сотрудника: используй только материалы, переданные в этом запросе.";

        return """
                Ты Ведалина, ассистент VEDAL по продукции, документам и сервису.
                %s

                Правила:
                - отвечай на русском языке;
                - используй только блок APPROVED_CONTEXT;
                - не добавляй факты, которых нет в APPROVED_CONTEXT;
                - не придумывай цены, сроки поставки, наличие, сертификаты и характеристики;
                - не давай диагнозы, лечение и клинические рекомендации;
                - если данных недостаточно, прямо скажи, что информация ожидает подтверждения;
                - в конце мягко предложи открыть ссылки или обратиться к специалисту.
                """.formatted(visibility);
    }

    private static String userPrompt(String question, Grounded grounded) {
        var sources = new StringBuilder();
        for (var i = 0; i < grounded.sources().size(); i++) {
            var source = grounded.sources().get(i);
            sources.append(i + 1)
                    .append(". [").append(source.kind()).append("] ")
                    .append(source.title())
                    .append(" — ").append(source.url())
                    .append('\n');
        }

        return """
                QUESTION:
                %s

                APPROVED_CONTEXT:
                Локальный безопасный ответ:
                %s

                Источники:
                %s

                Сформулируй короткий ответ для посетителя. Смысл локального ответа сохрани,
                новые факты не добавляй.
                """.formatted(question, grounded.text(), sources);
    }

    private static Optional<String> generatedText(YandexCompletionResponse response) {
        if (response == null || response.result() == null
                || response.result().alternatives() == null
                || response.result().alternatives().isEmpty()) {
            return Optional.empty();
        }

        var message = response.result().alternatives().getFirst().message();
        if (message == null || message.text() == null || message.text().isBlank()) {
            return Optional.empty();
        }
        return Optional.of(message.text().trim());
    }

    record YandexCompletionRequest(String modelUri,
                                   CompletionOptions completionOptions,
                                   List<Message> messages) {}

    record CompletionOptions(boolean stream, double temperature, String maxTokens) {}

    record Message(String role, String text) {}

    record YandexCompletionResponse(Result result) {}

    record Result(List<Alternative> alternatives) {}

    record Alternative(Message message, String status) {}
}
