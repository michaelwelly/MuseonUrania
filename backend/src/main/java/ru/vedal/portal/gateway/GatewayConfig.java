package ru.vedal.portal.gateway;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.vedal.portal.common.RateLimit;

import java.time.Duration;

@Configuration
public class GatewayConfig {

    @Bean
    RateLimit formsRateLimit(@Value("${vedal.forms.rate-limit.count:5}") int limit,
                             @Value("${vedal.forms.rate-limit.window:PT10M}") Duration window) {
        return new RateLimit(limit, window);
    }
}
