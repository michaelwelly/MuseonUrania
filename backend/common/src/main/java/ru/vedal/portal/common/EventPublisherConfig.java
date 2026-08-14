package ru.vedal.portal.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// Как события покидают outbox. Три режима, выбор явный — молчаливое
// переключение брокера составом classpath было бы источником сюрпризов
// на развёртывании.
//
//   log      — событие уходит в лог, потребители работают в процессе.
//              Брокер не нужен, чтобы приложение работало.
//   kafka    — relay читает outbox и сам публикует в топик, потребители
//              по-прежнему в процессе.
//   debezium — outbox читает коннектор по журналу предзаписи PostgreSQL,
//              приложение забирает события из топиков. Никто не опрашивает
//              таблицу, и между COMMIT и публикацией нет ни щели, ни задержки
//              на период опроса.
@Configuration
public class EventPublisherConfig {

    private static final Logger log = LoggerFactory.getLogger(EventPublisherConfig.class);

    @Bean
    @ConditionalOnProperty(name = "vedal.events.publisher", havingValue = "log", matchIfMissing = true)
    EventPublisher loggingEventPublisher() {
        return event -> log.info("событие {} по {} {} payload={}",
                event.getType(), event.getAggregate(), event.getAggregateId(), event.getPayload());
    }

    // Растяжка, а не заглушка. В режиме debezium публикует коннектор, и relay
    // до этого места не доходит — но зависимость на EventPublisher у него
    // остаётся, и молчаливая пустышка означала бы, что ошибка в условии
    // выключения relay заканчивается тихо потерянными событиями.
    @Bean
    @ConditionalOnProperty(name = "vedal.events.publisher", havingValue = "debezium")
    EventPublisher cdcPublishesInstead() {
        return event -> {
            throw new IllegalStateException(
                    "Публикация делегирована Debezium, но relay попытался отправить событие "
                            + event.getId() + " сам. Это ошибка в условии выключения relay.");
        };
    }
}
