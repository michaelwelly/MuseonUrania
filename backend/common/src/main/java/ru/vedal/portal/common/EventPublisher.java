package ru.vedal.portal.common;

// Порт наружу. Ранняя реализация — запись в лог, полная — Kafka.
// Домены за этот порт не заглядывают: смена реализации не должна их трогать.
public interface EventPublisher {

    void publish(Outbox event);
}
