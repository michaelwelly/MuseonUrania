package ru.vedal.portal.assistant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import ru.vedal.portal.common.RateLimit;
import tools.jackson.databind.ObjectMapper;

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
            ObjectMapper json,
            @Value("${vedal.assistant.engine:search}") String engine,
            @Value("${vedal.assistant.yandex.api-key:}") String apiKey,
            @Value("${vedal.assistant.yandex.folder-id:}") String folderId,
            @Value("${vedal.assistant.yandex.model:yandexgpt-lite/latest}") String model,
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
        if (apiKey.isBlank() || folderId.isBlank()) {
            throw new IllegalStateException("""
                    vedal.assistant.engine=yandexgpt, но ключ модели не задан.
                    Нужны переменные окружения VEDAL_YANDEX_API_KEY (Api-Key \
                    сервисного аккаунта) и VEDAL_YANDEX_FOLDER (идентификатор \
                    каталога Yandex Cloud). Без них ассистент отвечать не сможет; \
                    чтобы работать без модели, поставьте vedal.assistant.engine=search.""");
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

        log.info("Ведалина отвечает моделью {} (каталог {})", model, folderId);
        return new YandexGptEngine(search,
                new YandexGptHttp(YandexGptHttp.CLOUD, json, apiKey, folderId, model,
                        temperature, maxTokens, timeout));
    }
}
