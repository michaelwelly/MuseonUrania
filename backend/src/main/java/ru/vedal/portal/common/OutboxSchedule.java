package ru.vedal.portal.common;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// Только расписание. Вызовы идут через внедрённый бин, то есть через
// транзакционный прокси OutboxRelay — см. комментарий там.
@Component
public class OutboxSchedule {

    private final OutboxRelay relay;

    public OutboxSchedule(OutboxRelay relay) {
        this.relay = relay;
    }

    @Scheduled(fixedDelayString = "${vedal.outbox.relay.delay:PT5S}")
    public void tick() {
        relay.drain();
        relay.measure();
    }
}
