package ru.vedal.portal.assistant;

import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

/**
 * Эмбеддинги Yandex Foundation Models по HTTP.
 *
 * <p>Устройство то же, что у {@link YandexGptHttp}, и по тем же причинам:
 * адрес приходит конструктором ради теста, ключ — из окружения, схема
 * авторизации {@code Api-Key}, а не {@code Bearer}.
 *
 * <p><b>Две модели, а не одна.</b> {@code text-search-doc} кодирует фрагменты
 * документов, {@code text-search-query} — вопросы. Это пара: векторы
 * оказываются в одном пространстве именно потому, что модели разные.
 * Перепутать их — не отказ, а тихая порча выдачи.
 *
 * <p><b>Потока здесь нет.</b> Ответ — один вектор, и отдавать его по частям
 * нечего: показывать пользователю тут нечего вовсе, эмбеддинг — внутренняя
 * работа портала.
 */
public class YandexEmbeddings implements Embeddings {

    /** Дверь эмбеддингов в облаке. */
    public static final String CLOUD_URL =
            "https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding";

    /**
     * Длина вектора моделей поиска Яндекса.
     *
     * <p>Число здесь и размерность колонки {@code vector(256)} в миграции
     * V34 обязаны совпадать. Проверяется это на живом ответе модели,
     * а не на слово: {@link #vector} сверяет длину пришедшего массива
     * и отказывается писать в индекс то, что в него не влезет по смыслу.
     */
    public static final int DIMENSION = 256;

    private final URI url;
    private final HttpClient http;
    private final ObjectMapper json;
    private final String apiKey;
    private final String documentModelUri;
    private final String queryModelUri;
    private final Duration timeout;

    public YandexEmbeddings(URI url, ObjectMapper json, String apiKey,
                            String documentModelUri, String queryModelUri, Duration timeout) {
        this.url = url;
        this.json = json;
        this.apiKey = apiKey;
        this.documentModelUri = documentModelUri;
        this.queryModelUri = queryModelUri;
        this.timeout = timeout;
        this.http = HttpClient.newBuilder().connectTimeout(timeout).build();
    }

    @Override
    public int dimension() {
        return DIMENSION;
    }

    @Override
    public String name() {
        return documentModelUri;
    }

    @Override
    public float[] ofDocument(String text) {
        return vector(documentModelUri, text);
    }

    @Override
    public float[] ofQuery(String text) {
        return vector(queryModelUri, text);
    }

    private float[] vector(String modelUri, String text) {
        var request = HttpRequest.newBuilder(url)
                .timeout(timeout)
                .header("Content-Type", "application/json")
                .header("Authorization", "Api-Key " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(
                        json.writeValueAsString(Map.of("modelUri", modelUri, "text", text)),
                        StandardCharsets.UTF_8))
                .build();

        try {
            var response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) {
                throw new IllegalStateException("Эмбеддинги ответили " + response.statusCode()
                        + ": " + head(response.body()));
            }
            return parse(response.body());

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Ожидание эмбеддинга прервано", e);
        } catch (java.io.IOException e) {
            throw new IllegalStateException("Эмбеддинги недоступны: " + e.getMessage(), e);
        }
    }

    private float[] parse(String body) {
        var node = json.readTree(body).path("embedding");
        if (!node.isArray() || node.isEmpty()) {
            throw new IllegalStateException(
                    "Ответ эмбеддингов без вектора: " + head(body));
        }

        // Расхождение размерности — отказ, и это главная проверка здесь.
        // Молча записанный вектор другой длины не влезет в колонку
        // vector(256), и падение приедет из базы — то есть в месте, где
        // о моделях ничего не известно и сообщение будет про SQL.
        if (node.size() != DIMENSION) {
            throw new IllegalStateException(
                    "Модель вернула вектор длины " + node.size() + ", а индекс рассчитан на "
                            + DIMENSION + ". Размерность прошита в колонке knowledge_chunk.embedding: "
                            + "смена модели эмбеддингов — это отдельная миграция и полная "
                            + "переиндексация корпуса.");
        }

        var vector = new float[node.size()];
        for (var at = 0; at < vector.length; at++) {
            vector[at] = (float) node.get(at).asDouble();
        }
        return vector;
    }

    /** Начало тела ошибки — в журнал, чтобы не гадать по коду. */
    private static String head(String body) {
        return body.length() <= 400 ? body : body.substring(0, 400);
    }
}
