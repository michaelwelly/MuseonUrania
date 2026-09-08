package ru.vedal.portal.assistant;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Разговор с эмбеддингами по HTTP.
 *
 * <p>Сервер поднимается тут же, на случайном порту: наружу тест не ходит —
 * ни за деньги, ни за чужой доступностью. Устройство то же, что
 * у {@code YandexGptHttpTest}, и по тем же причинам.
 */
class YandexEmbeddingsTest {

    private HttpServer server;
    private final ObjectMapper json = new ObjectMapper();
    private final AtomicReference<String> lastAuth = new AtomicReference<>();
    private final AtomicReference<String> lastBody = new AtomicReference<>();

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private void answering(int status, String body) {
        server.createContext("/foundationModels/v1/textEmbedding", exchange -> {
            lastAuth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            lastBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));

            var bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            try (var out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        });
        server.start();
    }

    private Embeddings client() {
        var here = URI.create("http://127.0.0.1:" + server.getAddress().getPort()
                + "/foundationModels/v1/textEmbedding");
        return new YandexEmbeddings(here, json, "test-api-key-ascii",
                "emb://каталог-1/text-search-doc/latest",
                "emb://каталог-1/text-search-query/latest",
                Duration.ofSeconds(5));
    }

    /** Ответ двери: вектор нужной длины. */
    private static String vectorOf(int size) {
        return "{\"embedding\":[" + IntStream.range(0, size)
                .mapToObj(at -> "0.01")
                .collect(Collectors.joining(",")) + "]}";
    }

    @Test
    void theVectorComesBackWithTheDeclaredDimension() {
        answering(200, vectorOf(YandexEmbeddings.DIMENSION));

        var vector = client().ofDocument("Синтетический фрагмент про красный кубик.");

        assertThat(vector).hasSize(YandexEmbeddings.DIMENSION);
        assertThat(lastAuth.get())
                .as("Api-Key, а не Bearer: у статического ключа своя схема")
                .isEqualTo("Api-Key test-api-key-ascii");
    }

    // Документы и вопросы кодируются РАЗНЫМИ моделями, и векторы попадают
    // в одно пространство ровно поэтому. Перепутать их — не отказ, а тихо
    // испорченная выдача, поэтому адрес модели проверяется в запросе.
    @Test
    void aQuestionGoesToTheQueryModelAndAFragmentToTheDocumentModel() {
        answering(200, vectorOf(YandexEmbeddings.DIMENSION));
        var client = client();

        client.ofDocument("Синтетический фрагмент.");
        assertThat(lastBody.get()).contains("text-search-doc");

        client.ofQuery("что это за фигура");
        assertThat(lastBody.get()).contains("text-search-query");
    }

    // Главная проверка этого класса: размерность прошита в колонке
    // knowledge_chunk.embedding, и вектор другой длины туда не влезет.
    // Отказ должен приехать отсюда, с внятным текстом, а не из базы
    // сообщением про SQL.
    @Test
    void aVectorOfAnotherLengthIsRefusedWithAReadableMessage() {
        answering(200, vectorOf(512));

        assertThatThrownBy(() -> client().ofDocument("Синтетический фрагмент."))
                .hasMessageContaining("512")
                .hasMessageContaining("переиндексация");
    }

    @Test
    void anErrorFromTheDoorBecomesAFailureAndNotAnEmptyVector() {
        answering(401, "{\"error\":\"unauthorized\"}");

        assertThatThrownBy(() -> client().ofQuery("вопрос"))
                .hasMessageContaining("401");
    }

    @Test
    void anAnswerWithoutAVectorIsAFailure() {
        answering(200, "{\"numTokens\":\"7\"}");

        assertThatThrownBy(() -> client().ofQuery("вопрос"))
                .hasMessageContaining("без вектора");
    }
}
