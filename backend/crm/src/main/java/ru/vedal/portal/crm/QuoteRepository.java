package ru.vedal.portal.crm;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface QuoteRepository extends JpaRepository<Quote, UUID> {

    List<Quote> findByDealIdOrderByCreatedAtDesc(UUID dealId);

    Page<Quote> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Quote> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    // Номер выдаёт последовательность базы, а не счётчик в коде: два менеджера,
    // нажавшие «создать КП» одновременно, получили бы один номер — и спор
    // о том, какое из двух предложений действующее.
    @Query(value = "select nextval('quote_number_seq')", nativeQuery = true)
    long nextNumber();
}
