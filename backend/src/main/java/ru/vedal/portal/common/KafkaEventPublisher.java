package ru.vedal.portal.common;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

// Полная реализация порта EventPublisher.
//
// Имя топика — это тип события: vedal.leads.v1, vedal.documents.v1,
// vedal.notifications.v1, vedal.audit.v1. Отдельного маппинга нет намеренно,
// иначе появляется место, где имя топика и тип события расходятся.
@Component
@ConditionalOnProperty(name = "vedal.events.publisher", havingValue = "kafka")
public class KafkaEventPublisher implements EventPublisher {

    private final KafkaTemplate<String, String> kafka;
    private final long timeoutSeconds;

    public KafkaEventPublisher(KafkaTemplate<String, String> kafka,
                               @org.springframework.beans.factory.annotation.Value(
                                       "${vedal.events.send-timeout-seconds:10}") long timeoutSeconds) {
        this.kafka = kafka;
        this.timeoutSeconds = timeoutSeconds;
    }

    @Override
    public void publish(Outbox event) {
        var message = MessageBuilder
                .withPayload(event.getPayload())
                .setHeader(KafkaHeaders.TOPIC, event.getType())
                // Ключ партиционирования — идентификатор сущности: события
                // одного лида не должны переставляться местами.
                .setHeader(KafkaHeaders.KEY, event.getAggregateId())
                .setHeader("eventId", event.getId().toString())
                .setHeader("aggregate", event.getAggregate())
                .setHeader(CorrelationId.HEADER, event.getCorrelationId())
                .build();

        try {
            // Ждём подтверждения. Асинхронная отправка здесь означала бы, что
            // relay проставит published_at раньше, чем брокер принял событие,
            // и потерянное событие уже никто не восстановит.
            kafka.send(message).get(timeoutSeconds, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Отправка события " + event.getId() + " прервана", e);
        } catch (Exception e) {
            // Исключение обязано вылететь наружу: relay не выставит published_at,
            // и событие уйдёт в следующем заходе.
            throw new IllegalStateException("Не удалось опубликовать событие " + event.getId(), e);
        }
    }
}
