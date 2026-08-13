package ru.vedal.portal.common;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

// Раздача события потребителям и отсечение повторов.
//
// Вынесено из OutboxRelay, потому что доставок теперь две: relay, раздающий
// события в процессе, и консьюмер топика, забирающий их из Kafka после
// Debezium. Правило идемпотентности у них обязано быть одним и тем же —
// написанное дважды, оно однажды разойдётся, и одно письмо уйдёт клиенту
// дважды.
@Component
public class EventDispatch {

    private final EventConsumedRepository consumed;
    private final List<DomainEventConsumer> consumers;

    public EventDispatch(EventConsumedRepository consumed, List<DomainEventConsumer> consumers) {
        this.consumed = consumed;
        this.consumers = consumers;
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void dispatch(Outbox event) {
        // Восстанавливаем цепочку запроса: этот код работает в потоке
        // расписания или консьюмера, где MDC пуст, и без этого логи и письма
        // теряют связь с заявкой, которая их породила.
        CorrelationId.runWith(event.getCorrelationId(), () -> {
            for (var consumer : consumers) {
                if (!consumer.handles(event.getType())) continue;
                if (consumed.existsByConsumerAndEventId(consumer.name(), event.getId())) continue;

                consumer.consume(event);

                var mark = new EventConsumed();
                mark.setId(UUID.randomUUID());
                mark.setConsumer(consumer.name());
                mark.setEventId(event.getId());
                consumed.save(mark);
            }
        });
    }
}
