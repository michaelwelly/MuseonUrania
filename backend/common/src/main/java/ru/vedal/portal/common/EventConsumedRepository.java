package ru.vedal.portal.common;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface EventConsumedRepository extends JpaRepository<EventConsumed, UUID> {

    boolean existsByConsumerAndEventId(String consumer, UUID eventId);
}
