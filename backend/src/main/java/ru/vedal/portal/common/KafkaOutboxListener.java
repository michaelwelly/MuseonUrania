package ru.vedal.portal.common;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;

// Потребитель событий из топиков. Работает в режиме debezium: строку outbox
// в топик кладёт коннектор по журналу предзаписи, приложение забирает её
// отсюда.
//
// Домены об этом не знают: события раздаются тем же DomainEventConsumer'ам
// и с тем же отсечением повторов по (потребитель, событие), что и раньше.
// Форма потребителя не поменялась — в этом и был смысл держать её такой
// с самого начала.
@Component
@ConditionalOnProperty(name = "vedal.events.publisher", havingValue = "debezium")
public class KafkaOutboxListener {

    private static final Logger log = LoggerFactory.getLogger(KafkaOutboxListener.class);

    // Заголовок с идентификатором события ставит EventRouter из имени колонки
    // в transforms.outbox.table.field.event.id.
    private static final String EVENT_ID = "id";
    private static final String CORRELATION_ID = "correlationId";
    private static final String AGGREGATE = "aggregate";

    private final OutboxRepository outbox;
    private final EventDispatch dispatch;

    public KafkaOutboxListener(OutboxRepository outbox, EventDispatch dispatch) {
        this.outbox = outbox;
        this.dispatch = dispatch;
    }

    @KafkaListener(topics = {KafkaTopics.LEADS, KafkaTopics.DOCUMENTS,
            KafkaTopics.NOTIFICATIONS, KafkaTopics.AUDIT},
            groupId = "${vedal.events.group-id:vedal-portal}")
    @Transactional
    public void consume(ConsumerRecord<String, String> record) {
        var id = header(record, EVENT_ID);
        if (id == null) {
            // Без идентификатора нечем отсечь повтор. Пропустить такое
            // сообщение молча — значит отправить письмо второй раз при первой
            // же переотправке партиции; пусть уезжает в DLQ и разбирается руками.
            throw new IllegalStateException("В сообщении из " + record.topic()
                    + " нет заголовка " + EVENT_ID + ": проверьте настройку EventRouter");
        }

        var eventId = UUID.fromString(id);

        // Событие собирается в ту же форму, в которой его видит relay.
        // Сохранённая строка из базы предпочтительнее собранной из сообщения:
        // в ней payload ровно тот, что был закоммичен, без превращений
        // конвертером Connect.
        var event = outbox.findById(eventId).orElseGet(() -> carrier(record, eventId));

        dispatch.dispatch(event);

        // Отметку ставим здесь, а не в relay: так лаг меряет весь путь
        // COMMIT → журнал предзаписи → коннектор → топик → потребитель,
        // а не то, что мы успели положить в очередь. Встал любой участок —
        // лаг растёт, и алерт срабатывает.
        if (event.getPublishedAt() == null && outbox.existsById(eventId)) {
            event.setPublishedAt(Instant.now());
            outbox.save(event);
        }
    }

    // Строки в outbox уже нет — её вычистили. Событие всё равно надо разобрать:
    // потерять его из-за уборки хуже, чем разобрать без исходной строки.
    private static Outbox carrier(ConsumerRecord<String, String> record, UUID eventId) {
        var event = new Outbox();
        event.setId(eventId);
        event.setType(record.topic());
        event.setAggregate(header(record, AGGREGATE));
        event.setAggregateId(record.key());
        event.setPayload(record.value());
        event.setCorrelationId(header(record, CORRELATION_ID));
        log.warn("строки outbox {} уже нет, событие разбирается по сообщению", eventId);
        return event;
    }

    private static String header(ConsumerRecord<String, String> record, String name) {
        var header = record.headers().lastHeader(name);
        return header == null ? null : new String(header.value(), StandardCharsets.UTF_8);
    }
}
