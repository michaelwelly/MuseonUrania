package ru.vedal.portal.notifications;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OutboundMailRepository extends JpaRepository<OutboundMail, UUID> {

    List<OutboundMail> findByStatusOrderByCreatedAtAsc(String status, Limit limit);

    long countByStatus(String status);
}
