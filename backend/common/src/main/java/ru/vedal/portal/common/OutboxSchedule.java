package ru.vedal.portal.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// Только расписание. Вызовы идут через внедрённый бин, то есть через
// транзакционный прокси OutboxRelay — см. комментарий там.
@Component
public class OutboxSchedule {

    private final OutboxRelay relay;
    private final boolean cdcPublishes;

    public OutboxSchedule(OutboxRelay relay,
                          @Value("${vedal.events.publisher:log}") String mode) {
        this.relay = relay;
        this.cdcPublishes = "debezium".equals(mode);
    }

    @Scheduled(fixedDelayString = "${vedal.outbox.relay.delay:PT5S}")
    public void tick() {
        // Проверка стоит здесь, до вызова через транзакционный прокси.
        // Внутри drain() она означала бы открытую и закрытую транзакцию
        // каждые пять секунд впустую — семнадцать тысяч пустых транзакций
        // в сутки, которые попадают в статистику базы и маскируют настоящую
        // нагрузку.
        if (!cdcPublishes) relay.drain();
        relay.measure();
    }
}
