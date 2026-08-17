package ru.vedal.portal.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AuditEntryRepository extends JpaRepository<AuditEntry, UUID> {

    List<AuditEntry> findBySubjectAndSubjectIdOrderByAtDesc(String subject, String subjectId);

    List<AuditEntry> findByCorrelationIdOrderByAtAsc(String correlationId);

    // Фильтры необязательные и комбинируются. Через имена методов это дало бы
    // восемь перегрузок на три поля; здесь null означает «не фильтровать».
    @Query("""
            select e from AuditEntry e
             where (:subject is null or e.subject = :subject)
               and (:subjectId is null or e.subjectId = :subjectId)
               and (:actor is null or e.actor = :actor)
             order by e.at desc
            """)
    Page<AuditEntry> search(@Param("subject") String subject,
                            @Param("subjectId") String subjectId,
                            @Param("actor") String actor,
                            Pageable pageable);
}
