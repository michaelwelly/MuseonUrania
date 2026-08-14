package ru.vedal.portal.crm;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DealRepository extends JpaRepository<Deal, UUID> {

    Optional<Deal> findByLeadId(UUID leadId);

    Page<Deal> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Deal> findByPipelineOrderByCreatedAtDesc(String pipeline, Pageable pageable);

    Page<Deal> findByPipelineAndStageOrderByCreatedAtDesc(String pipeline, String stage, Pageable pageable);

    Page<Deal> findByClientIdOrderByCreatedAtDesc(UUID clientId, Pageable pageable);

    long countByClientId(UUID clientId);

    // Какие из этих заявок уже разобраны в сделку. Одним запросом на страницу,
    // а не по запросу на строку: список заявок иначе превращается в N+1.
    List<Deal> findByLeadIdIn(Collection<UUID> leadIds);
}
