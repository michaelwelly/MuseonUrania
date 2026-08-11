package ru.vedal.portal.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AuditEntryRepository extends JpaRepository<AuditEntry, UUID> {

    List<AuditEntry> findBySubjectAndSubjectIdOrderByAtDesc(String subject, String subjectId);

    List<AuditEntry> findByCorrelationIdOrderByAtAsc(String correlationId);
}
