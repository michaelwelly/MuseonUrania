package ru.vedal.portal.assistant;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.vedal.portal.common.RateLimit;

import java.time.Duration;

@Configuration
public class AssistantConfig {

    // Свой бюджет, отдельный от форм: разговор с ассистентом не должен
    // отнимать у посетителя право отправить заявку.
    @Bean
    RateLimit assistantRateLimit(@Value("${vedal.assistant.rate-limit.count:20}") int limit,
                                @Value("${vedal.assistant.rate-limit.window:PT10M}") Duration window) {
        return new RateLimit(limit, window);
    }
}
