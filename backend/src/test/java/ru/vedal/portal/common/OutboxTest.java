package ru.vedal.portal.common;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.PostgresTestBase;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class OutboxTest extends PostgresTestBase {

    @Autowired
    DomainEvents events;

    @Autowired
    OutboxRelay relay;

    @Autowired
    OutboxRepository outbox;

    @Test
    void eventIsPublishedOnceAndMarkedSent() {
        outbox.deleteAll();

        var id = events.record("probe", "p-1", "vedal.probe.v1", Map.of("k", 1));
        assertThat(outbox.findById(id).orElseThrow().getPublishedAt())
                .as("свежее событие не отправлено")
                .isNull();

        assertThat(relay.drain()).isEqualTo(1);
        assertThat(outbox.findById(id).orElseThrow().getPublishedAt())
                .as("после отправки выставлен published_at")
                .isNotNull();

        // Второй заход не должен подхватить то же событие. Именно это ломалось,
        // когда расписание вызывало drain() у себя же: вызов шёл мимо
        // транзакционного прокси, published_at не сохранялся, и событие
        // уезжало заново в каждом заходе.
        assertThat(relay.drain())
                .as("повторный заход не пересылает отправленное")
                .isZero();
    }

    @Test
    void payloadSurvivesRoundTrip() {
        outbox.deleteAll();

        var id = events.record("lead", "L-42", "vedal.leads.v1", Map.of("form", "quote"));

        assertThat(outbox.findById(id).orElseThrow().getPayload()).contains("quote");
    }
}
