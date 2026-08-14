package ru.vedal.portal.common;

// Локальный потребитель события. Пока Kafka нет, relay раздаёт события
// в процессе; форма та же, что будет у консьюмера топика, поэтому переезд
// не потребует правок в потребителях.
//
// Реализация обязана быть идемпотентной: relay отсекает повтор по
// (name, event_id), но при падении между consume и отметкой событие придёт
// второй раз.
public interface DomainEventConsumer {

    String name();

    boolean handles(String type);

    void consume(Outbox event);
}
