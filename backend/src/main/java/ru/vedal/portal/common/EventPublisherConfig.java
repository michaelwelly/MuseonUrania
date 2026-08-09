package ru.vedal.portal.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// Ранняя реализация порта EventPublisher: пока Kafka нет, событие уходит в лог.
// Заменяется на Kafka-реализацию конфигурацией, без правок в доменах.
@Configuration
public class EventPublisherConfig {

    private static final Logger log = LoggerFactory.getLogger(EventPublisherConfig.class);

    @Bean
    @ConditionalOnMissingBean(EventPublisher.class)
    EventPublisher loggingEventPublisher() {
        return event -> log.info("событие {} по {} {} payload={}",
                event.getType(), event.getAggregate(), event.getAggregateId(), event.getPayload());
    }
}
