package ru.vedal.portal.common;

import org.apache.kafka.common.TopicPartition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaOperations;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

// Что происходит с сообщением, которое потребитель не смог разобрать.
//
// Без этой настройки Spring Kafka повторяет доставку бесконечно, и один битый
// payload останавливает конвейер: за ним встают все события того же раздела,
// включая заявки. Отсюда DLQ — она в спеке архитектуры и здесь получает
// реализацию.
@Configuration
@ConditionalOnProperty(name = "vedal.events.publisher", havingValue = "debezium")
public class KafkaConsumerConfig {

    private static final Logger log = LoggerFactory.getLogger(KafkaConsumerConfig.class);

    @Bean
    DefaultErrorHandler kafkaErrorHandler(KafkaOperations<Object, Object> kafka,
                                          @Value("${vedal.events.retry.attempts:3}") long attempts,
                                          @Value("${vedal.events.retry.delay-ms:2000}") long delayMs) {
        var recoverer = new DeadLetterPublishingRecoverer(kafka, (record, exception) -> {
            var dlq = KafkaTopics.dlq(record.topic());
            log.error("событие из {} не разобрано после повторов, уходит в {}: {}",
                    record.topic(), dlq, exception.getMessage());
            // Раздел ноль, а не тот же, что у исходного сообщения: у DLQ
            // один раздел, и попытка записать в третий закончилась бы отказом.
            return new TopicPartition(dlq, 0);
        });

        // Повторы с паузой, а не мгновенные: чаще всего причина — недоступная
        // на секунду база или почтовый шлюз, и три попытки подряд без паузы
        // просто израсходуют их за один и тот же сбой.
        return new DefaultErrorHandler(recoverer, new FixedBackOff(delayMs, attempts));
    }
}
