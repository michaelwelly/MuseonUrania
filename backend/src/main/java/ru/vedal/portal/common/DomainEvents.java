package ru.vedal.portal.common;

// Jackson 3: пакет tools.jackson, а не com.fasterxml.jackson — Boot 4 идёт с ним.
import tools.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

// Единственный способ породить событие. Пишет строку в outbox внутри уже
// открытой транзакции вызывающего — поэтому MANDATORY: событие без бизнес-записи
// или бизнес-запись без события означают потерянную заявку.
@Service
public class DomainEvents {

    private final OutboxRepository outbox;
    private final ObjectMapper json;

    public DomainEvents(OutboxRepository outbox, ObjectMapper json) {
        this.outbox = outbox;
        this.json = json;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public UUID record(String aggregate, String aggregateId, String type, Map<String, ?> payload) {
        var event = new Outbox();
        event.setId(UUID.randomUUID());
        event.setAggregate(aggregate);
        event.setAggregateId(aggregateId);
        event.setType(type);
        event.setPayload(serialize(type, payload));
        outbox.save(event);
        return event.getId();
    }

    private String serialize(String type, Map<String, ?> payload) {
        try {
            return json.writeValueAsString(payload == null ? Map.of() : payload);
        } catch (Exception e) {
            // Событие, которое не сериализуется, обязано валить транзакцию:
            // иначе бизнес-запись уедет в базу без своего события.
            throw new IllegalArgumentException("Не удалось сериализовать событие " + type, e);
        }
    }
}
