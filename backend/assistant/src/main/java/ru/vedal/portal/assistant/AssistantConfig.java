package ru.vedal.portal.assistant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;
import ru.vedal.portal.catalog.CatalogQuery;
import ru.vedal.portal.common.RateLimit;
import ru.vedal.portal.content.ContentQuery;
import ru.vedal.portal.documents.DocumentQuery;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.time.Duration;

@Configuration
public class AssistantConfig {

    private static final Logger log = LoggerFactory.getLogger(AssistantConfig.class);

    // Свой бюджет, отдельный от форм: разговор с ассистентом не должен
    // отнимать у посетителя право отправить заявку.
    @Bean
    RateLimit assistantRateLimit(@Value("${vedal.assistant.rate-limit.count:20}") int limit,
                                @Value("${vedal.assistant.rate-limit.window:PT10M}") Duration window) {
        return new RateLimit(limit, window);
    }

    /**
     * Кто отвечает: модель или поиск по словам.
     *
     * <p><b>Почему выбор настройкой, а не наличием ключа.</b> «Есть ключ —
     * работает модель» звучит удобно ровно до первого раза, когда ключ
     * не доехал в окружение: портал молча начинает отвечать перечнем ссылок,
     * и понять это можно только по тому, что ответы вдруг стали суше.
     * Здесь режим объявлен явно, и несобранная пара «режим + ключ» роняет
     * старт с внятным сообщением, а не работает наполовину.
     *
     * <p>Значение по умолчанию — поиск: на машине разработчика и в тестах
     * ключей нет и быть не должно, а чат обязан работать.
     *
     * <p>{@code @Primary} обязателен: {@link DeterministicSearch} сам по себе
     * бин и сам по себе {@link LlmEngine}, поэтому претендентов на место
     * движка двое. Главный — этот: он и решает, кто отвечает. В режиме
     * поиска он возвращает тот же самый объект, так что двух движков
     * в приложении не появляется ни при какой настройке.
     */
    @Bean
    @Primary
    LlmEngine llmEngine(
            DeterministicSearch search,
            ObjectProvider<VectorSearch> vectors,
            JdbcClient jdbc,
            ObjectMapper json,
            @Value("${vedal.assistant.engine:search}") String engine,
            @Value("${vedal.assistant.yandex.api-key:}") String apiKey,
            @Value("${vedal.assistant.yandex.model-uri:}") String modelUri,
            @Value("${vedal.assistant.yandex.endpoint:" + YandexGptHttp.CLOUD_URL + "}") String endpoint,
            @Value("${vedal.assistant.yandex.fallback:true}") boolean fallback,
            @Value("${vedal.assistant.yandex.temperature:0.2}") double temperature,
            @Value("${vedal.assistant.yandex.max-tokens:600}") int maxTokens,
            @Value("${vedal.assistant.yandex.timeout:PT25S}") Duration timeout) {

        if (!"yandexgpt".equalsIgnoreCase(engine)) {
            log.info("Ведалина отвечает поиском по опубликованному "
                    + "(vedal.assistant.engine={})", engine);
            return search;
        }

        // Отказ на старте, а не при первом вопросе посетителя: без ключа
        // модель не ответит ни разу, и узнать об этом лучше при развёртывании,
        // чем из жалобы «ассистент перестал отвечать».
        if (apiKey.isBlank() || modelUri.isBlank()) {
            throw new IllegalStateException("""
                    vedal.assistant.engine=yandexgpt, но доступ к модели не задан.
                    Нужны переменные окружения VEDAL_YANDEX_API_KEY (Api-Key \
                    сервисного аккаунта) и VEDAL_YANDEXGPT_MODEL_URI — адрес \
                    модели целиком, вида gpt://<каталог>/yandexgpt-lite/latest. \
                    Без них ассистент отвечать не сможет; чтобы работать без \
                    модели, поставьте vedal.assistant.engine=search.""");
        }

        // Адрес модели проверяется здесь, а не в облаке: без схемы gpt://
        // дверь отвечает 404, и по коду это неотличимо от «нет такой модели».
        // Разбирать URI на каталог и имя портал не станет — его выдаёт консоль
        // целиком, и лишний разбор означал бы третью переменную и третий способ
        // ошибиться.
        if (!modelUri.startsWith("gpt://")) {
            throw new IllegalStateException(
                    "VEDAL_YANDEXGPT_MODEL_URI должен начинаться с gpt:// и выглядеть как "
                            + "gpt://<идентификатор каталога>/yandexgpt-lite/latest, а задано: "
                            + modelUri);
        }

        // Ключ уезжает в заголовок Authorization, а туда пускают только ASCII.
        // Поймано тестом: с кириллицей запрос падает на «invalid header value»,
        // и по этой ошибке не догадаться, что дело в самом ключе, — она
        // приходит из клиента, а не из облака. Обычно это лишний символ,
        // приехавший вместе с копированием из консоли.
        if (!apiKey.chars().allMatch(c -> c > 0x20 && c < 0x7F)) {
            throw new IllegalStateException(
                    "VEDAL_YANDEX_API_KEY содержит пробелы или не-ASCII символы. "
                            + "Ключ Yandex Cloud состоит из латиницы, цифр и дефисов — "
                            + "похоже, при копировании прихватилось лишнее.");
        }

        // Векторный поиск подключается перед словесным, а не вместо него:
        // пока корпуса документов нет, индекс пуст, и RagRetrieval честно
        // передаёт слово прежнему поиску. Бина VectorSearch нет вовсе, пока
        // не задан ключ эмбеддингов, — тогда retrieval остаётся прежним.
        Retrieval retrieval = vectors.<Retrieval>stream()
                .findFirst()
                .map(vector -> {
                    log.info("Ведалина ищет по индексу pgvector, "
                            + "не нашлось — поиском по словам");
                    return (Retrieval) new RagRetrieval(vector, new IndexedDocumentSearch(search, jdbc));
                })
                .orElse(search);

        log.info("Ведалина отвечает моделью {}", modelUri);
        return new YandexGptEngine(retrieval,
                new YandexGptHttp(URI.create(endpoint), json, apiKey, modelUri,
                        temperature, maxTokens, timeout),
                fallback);
    }

    /**
     * Модель эмбеддингов. Заводится только вместе с ключом.
     *
     * <p>Причина та же, по которой режим ассистента объявляется явно:
     * половинчато настроенный RAG хуже выключенного. Нет ключа — нет бина
     * {@link Embeddings}, нет {@link VectorSearch}, нет {@link KnowledgeIndex},
     * и ассистент работает ровно как до pgvector. Есть ключ — работает всё,
     * и пустой индекс этому не мешает.
     *
     * <p>Ключ тот же, что у YandexGPT: эмбеддинги живут в том же Foundation
     * Models и оплачиваются тем же сервисным аккаунтом. Второй переменной
     * под тот же ключ здесь нет — это был бы второй способ ошибиться.
     */
    @Bean
    @ConditionalOnProperty(name = "vedal.assistant.rag.enabled", havingValue = "true")
    Embeddings embeddings(
            ObjectMapper json,
            @Value("${vedal.assistant.yandex.api-key:}") String apiKey,
            @Value("${vedal.assistant.rag.document-model-uri:}") String documentModelUri,
            @Value("${vedal.assistant.rag.query-model-uri:}") String queryModelUri,
            @Value("${vedal.assistant.rag.endpoint:" + YandexEmbeddings.CLOUD_URL + "}") String endpoint,
            @Value("${vedal.assistant.rag.timeout:PT15S}") Duration timeout) {

        if (apiKey.isBlank() || documentModelUri.isBlank() || queryModelUri.isBlank()) {
            throw new IllegalStateException("""
                    vedal.assistant.rag.enabled=true, но доступ к эмбеддингам не задан.
                    Нужны VEDAL_YANDEXGPT_API_KEY и пара адресов моделей поиска: \
                    VEDAL_RAG_DOCUMENT_MODEL_URI (emb://<каталог>/text-search-doc/latest) \
                    и VEDAL_RAG_QUERY_MODEL_URI (emb://<каталог>/text-search-query/latest). \
                    Модели именно две: документы и вопросы кодируются разными, \
                    и векторы попадают в одно пространство ровно поэтому. \
                    Чтобы работать без векторного поиска, поставьте \
                    vedal.assistant.rag.enabled=false.""");
        }

        // Проверка схемы — та же, что у адреса модели генерации, и по той же
        // причине: с чужой схемой дверь отвечает 404, и по коду это
        // неотличимо от «нет такой модели».
        for (var uri : new String[] {documentModelUri, queryModelUri}) {
            if (!uri.startsWith("emb://")) {
                throw new IllegalStateException(
                        "Адрес модели эмбеддингов должен начинаться с emb:// и выглядеть как "
                                + "emb://<идентификатор каталога>/text-search-doc/latest, "
                                + "а задано: " + uri);
            }
        }

        log.info("Индекс Ведалины считается моделью {}", documentModelUri);
        return new YandexEmbeddings(URI.create(endpoint), json, apiKey,
                documentModelUri, queryModelUri, timeout);
    }

    @Bean
    @ConditionalOnProperty(name = "vedal.assistant.rag.enabled", havingValue = "true")
    VectorSearch vectorSearch(JdbcClient jdbc, Embeddings embeddings,
                              @Value("${vedal.assistant.rag.max-distance:0.45}") double maxDistance) {
        return new VectorSearch(jdbc, embeddings, maxDistance);
    }

    @Bean
    @ConditionalOnProperty(name = "vedal.assistant.rag.enabled", havingValue = "true")
    KnowledgeIndex knowledgeIndex(JdbcClient jdbc, TransactionTemplate transactions,
                                  Embeddings embeddings, CatalogQuery catalog,
                                  ContentQuery content, DocumentQuery documents,
                                  SitePages pages) {
        return new KnowledgeIndex(jdbc, transactions, embeddings, catalog, content, documents,
                pages);
    }

    /**
     * Очередь индексации: правка документа — событие — переиндексация.
     *
     * <p>Условие то же, что у остального RAG. Потребитель без индекса —
     * это событие, которое некому обработать, и отметка «обработано»
     * у необработанного: следующая доставка его уже пропустит.
     */
    @Bean
    @ConditionalOnProperty(name = "vedal.assistant.rag.enabled", havingValue = "true")
    KnowledgeIndexer knowledgeIndexer(KnowledgeIndex index) {
        return new KnowledgeIndexer(index);
    }
}
