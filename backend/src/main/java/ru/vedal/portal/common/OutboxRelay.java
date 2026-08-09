package ru.vedal.portal.common;

import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
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
    private final AtomicLong pending = new AtomicLong();
    private final AtomicLong lagSeconds = new AtomicLong();

    public OutboxRelay(OutboxRepository outbox, EventPublisher publisher, MeterRegistry meters) {
        this.outbox = outbox;
        this.publisher = publisher;
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
            event.setPublishedAt(Instant.now());
            outbox.save(event);
        }
        return batch.size();
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
