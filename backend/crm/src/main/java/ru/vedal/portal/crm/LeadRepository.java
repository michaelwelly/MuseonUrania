package ru.vedal.portal.crm;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LeadRepository extends JpaRepository<Lead, UUID> {

    Optional<Lead> findByIdempotencyKey(String idempotencyKey);

    // Отбор для автоочистки: старше срока и ещё не обезличенные. Под него
    // заведён частичный индекс lead_retention_idx — обезличенные из выборки
    // уходят навсегда, и место под них в индексе держать незачем, а со
    // временем их становится большинство.
    //
    // Пачкой, а не всё сразу: за первый проход после включения под нож пойдёт
    // всё накопленное, и одной транзакцией это блокировка таблицы на минуты.
    List<Lead> findByCreatedAtBeforeAndErasedAtIsNull(Instant cutoff, Pageable page);

    List<Lead> findAllByOrderByCreatedAtDesc();

    // Постранично: заявки копятся без предела, и «показать все» однажды
    // означает выгрузить всю базу в память ради одной страницы списка.
    Page<Lead> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Lead> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);
}
