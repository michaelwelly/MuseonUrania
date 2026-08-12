package ru.vedal.portal.common;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

// Топики заводятся здесь, а не первым обращением: в compose.yaml автосоздание
// выключено, потому что опечатка в имени не должна молча создавать новый топик
// и уводить туда события.
//
// Состав — из таблицы топиков в спеке архитектуры.
@Configuration
@ConditionalOnProperty(name = "vedal.events.publisher", havingValue = "kafka")
public class KafkaTopics {

    // Один брокер в разработке — реплик быть не может. В облаке значение
    // переопределяется, поэтому оно в конфигурации, а не в коде.
    @Bean
    NewTopic leads(@org.springframework.beans.factory.annotation.Value(
            "${vedal.events.replicas:1}") short replicas) {
        return TopicBuilder.name("vedal.leads.v1").partitions(3).replicas(replicas).build();
    }

    @Bean
    NewTopic documents(@org.springframework.beans.factory.annotation.Value(
            "${vedal.events.replicas:1}") short replicas) {
        return TopicBuilder.name("vedal.documents.v1").partitions(3).replicas(replicas).build();
    }

    @Bean
    NewTopic notifications(@org.springframework.beans.factory.annotation.Value(
            "${vedal.events.replicas:1}") short replicas) {
        return TopicBuilder.name("vedal.notifications.v1").partitions(3).replicas(replicas).build();
    }

    @Bean
    NewTopic audit(@org.springframework.beans.factory.annotation.Value(
            "${vedal.events.replicas:1}") short replicas) {
        return TopicBuilder.name("vedal.audit.v1").partitions(3).replicas(replicas).build();
    }
}
