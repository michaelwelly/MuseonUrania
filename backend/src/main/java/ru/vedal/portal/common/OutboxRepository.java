package ru.vedal.portal.common;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OutboxRepository extends JpaRepository<Outbox, UUID> {

    List<Outbox> findByPublishedAtIsNullOrderByCreatedAtAsc(Limit limit);

    // Самая старая неотправленная запись — по ней считается лаг.
    Optional<Outbox> findFirstByPublishedAtIsNullOrderByCreatedAtAsc();

    long countByPublishedAtIsNull();
}
