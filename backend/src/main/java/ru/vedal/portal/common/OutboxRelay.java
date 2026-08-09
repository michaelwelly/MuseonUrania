package ru.vedal.portal.common;

import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

// Чтение outbox и публикация. Домены сюда не обращаются: они только пишут
// строку события в своей транзакции.
//
// Расписание живёт в отдельном бине OutboxSchedule намеренно. Если дёргать
// drain() из @Scheduled-метода этого же класса, вызов пойдёт мимо
// транзакционного прокси: сущности окажутся отсоединёнными, published_at не
// сохранится, и одно и то же событие будет уезжать в каждом заходе.
@Component
public class OutboxRelay {

    private static final Logger log = LoggerFactory.getLogger(OutboxRelay.class);

    // Порог из спеки: записи старше пяти минут означают, что relay встал.
    // Приложение при этом зелёное и формы принимаются — заявки копятся и никуда
    // не уезжают, поэтому это главный сигнал, а не второстепенный.
    static final Duration LAG_ALERT = Duration.ofMinutes(5);

    private static final int BATCH = 100;

    private final OutboxRepository outbox;
    private final EventPublisher publisher;
    private final EventConsumedRepository consumed;
    private final List<DomainEventConsumer> consumers;
    private final AtomicLong pending = new AtomicLong();
    private final AtomicLong lagSeconds = new AtomicLong();

    public OutboxRelay(OutboxRepository outbox, EventPublisher publisher,
                       EventConsumedRepository consumed, List<DomainEventConsumer> consumers,
                       MeterRegistry meters) {
        this.outbox = outbox;
        this.publisher = publisher;
        this.consumed = consumed;
        this.consumers = consumers;
        meters.gauge("vedal.outbox.pending", pending);
        meters.gauge("vedal.outbox.lag.seconds", lagSeconds);
    }

    @Transactional
    public int drain() {
        var batch = outbox.findByPublishedAtIsNullOrderByCreatedAtAsc(Limit.of(BATCH));
        for (var event : batch) {
            // Отправка внутри транзакции: если публикация упала, published_at
            // не выставится и событие уйдёт в следующий заход. Дубль потребитель
            // отсечёт по идентификатору, потерянное событие не восстановит никто.
            publisher.publish(event);
            dispatch(event);
            event.setPublishedAt(Instant.now());
            outbox.save(event);
        }
        return batch.size();
    }

    // Пока Kafka нет, потребители живут в процессе. Отсечение повторов по
    // (потребитель, событие) — то же, что будет у консьюмера топика.
    private void dispatch(Outbox event) {
        // Восстанавливаем цепочку запроса: этот код работает в потоке
        // расписания, где MDC пуст, и без этого логи и письма теряют связь
        // с заявкой, которая их породила.
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

    @Transactional(readOnly = true)
    public void measure() {
        pending.set(outbox.countByPublishedAtIsNull());
        var oldest = outbox.findFirstByPublishedAtIsNullOrderByCreatedAtAsc();
        var lag = oldest.map(e -> Duration.between(e.getCreatedAt(), Instant.now())).orElse(Duration.ZERO);
        lagSeconds.set(lag.toSeconds());

        if (lag.compareTo(LAG_ALERT) > 0) {
            log.warn("лаг outbox {} с, неотправленных {} — relay не справляется или встал",
                    lag.toSeconds(), pending.get());
        }
    }

    long pendingCount() { return pending.get(); }

    long lagSeconds() { return lagSeconds.get(); }
}
