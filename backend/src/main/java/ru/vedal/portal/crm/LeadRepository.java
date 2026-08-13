package ru.vedal.portal.crm;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LeadRepository extends JpaRepository<Lead, UUID> {

    Optional<Lead> findByIdempotencyKey(String idempotencyKey);

    List<Lead> findAllByOrderByCreatedAtDesc();

    // Постранично: заявки копятся без предела, и «показать все» однажды
    // означает выгрузить всю базу в память ради одной страницы списка.
    Page<Lead> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Lead> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);
}
