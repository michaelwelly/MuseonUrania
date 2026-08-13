package ru.vedal.portal.common;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.KafkaAdmin;

import java.util.List;
import java.util.stream.Stream;

// Топики заводятся здесь, а не первым обращением: в compose.yaml автосоздание
// выключено, потому что опечатка в имени не должна молча создавать новый топик
// и уводить туда события.
//
// Состав — из таблицы топиков в спеке архитектуры. Имя топика совпадает
// с типом события, отдельного маппинга нет намеренно: иначе появляется место,
// где имя топика и тип события расходятся.
//
// Условие покрывает и kafka, и debezium: в обоих режимах топики нужны, и
// в обоих их создаёт приложение, а не брокер и не Connect.
@Configuration
@ConditionalOnExpression("'${vedal.events.publisher:log}' == 'kafka' or '${vedal.events.publisher:log}' == 'debezium'")
public class KafkaTopics {

    public static final String LEADS = "vedal.leads.v1";
    public static final String DOCUMENTS = "vedal.documents.v1";
    public static final String NOTIFICATIONS = "vedal.notifications.v1";
    public static final String AUDIT = "vedal.audit.v1";

    static final List<String> ALL = List.of(LEADS, DOCUMENTS, NOTIFICATIONS, AUDIT);

    // Необработанное после ретраев уходит сюда и разбирается руками: иначе
    // один битый payload останавливает конвейер, и за ним встают все заявки.
    public static String dlq(String topic) {
        return topic + ".dlq";
    }

    // Один брокер в разработке — реплик быть не может. В облаке значение
    // переопределяется, поэтому оно в конфигурации, а не в коде.
    //
    // Именно KafkaAdmin.NewTopics, а не список бинов NewTopic: KafkaAdmin
    // ищет в контексте бины типа NewTopic и NewTopics, и бин типа
    // List<NewTopic> он бы просто не увидел — топики молча не создались бы,
    // а с выключенным автосозданием это отказ при первой отправке.
    @Bean
    KafkaAdmin.NewTopics eventTopics(@Value("${vedal.events.replicas:1}") short replicas,
                                     @Value("${vedal.events.partitions:3}") int partitions) {
        var topics = ALL.stream()
                .flatMap(topic -> Stream.of(
                        TopicBuilder.name(topic).partitions(partitions).replicas(replicas).build(),
                        // У DLQ один раздел: разбор идёт руками и по порядку,
                        // а параллелить нечего — сюда попадают единицы сообщений.
                        TopicBuilder.name(dlq(topic)).partitions(1).replicas(replicas).build()))
                .toArray(NewTopic[]::new);
        return new KafkaAdmin.NewTopics(topics);
    }
}
