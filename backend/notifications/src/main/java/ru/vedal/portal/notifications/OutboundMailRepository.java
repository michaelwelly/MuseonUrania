package ru.vedal.portal.notifications;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Limit;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OutboundMailRepository extends JpaRepository<OutboundMail, UUID> {

    // Что пора отправлять. Возвращает идентификаторы, а не сущности: письма
    // отправляются каждое в своей транзакции, и сущность, вычитанная в чужой
    // транзакции, там всё равно не нужна — она была бы отсоединённой.
    //
    // Порядок по времени следующей попытки, а не по времени постановки:
    // письмо, отложенное на час после отказа, не должно опережать только что
    // принятую заявку. При равном времени старшинство у того, что в очереди
    // дольше.
    @Query("""
            select m.id from OutboundMail m
            where m.status = :status and m.nextAttemptAt <= :now
            order by m.nextAttemptAt asc, m.createdAt asc
            """)
    List<UUID> findDue(@Param("status") String status, @Param("now") Instant now, Limit limit);

    // Блокировка строки на время попытки. Один экземпляр портала обходится
    // и без неё — планировщик Spring однопоточный и сам себя не обгоняет.
    // Второй экземпляр без блокировки отправил бы то же письмо второй раз,
    // а это письмо клиенту. Цена — одна аннотация; конкурент не дублирует,
    // а ждёт и, получив блокировку, видит статус 'sent' и уходит.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from OutboundMail m where m.id = :id")
    Optional<OutboundMail> findForAttempt(@Param("id") UUID id);

    long countByStatus(String status);

    // Письма, отправленные по заявке. Нужен обезличиванию по обращению
    // субъекта: заявку и переписку по ней уже стирают одним обращением
    // (см. AdminPrivacyApi), письмо-подтверждение — тот же носитель
    // персональных данных и та же половина исполненного обращения, если его
    // забыть.
    List<OutboundMail> findByLeadId(UUID leadId);

    // Отбор для автоочистки: старше срока, ещё не обезличенные и не в очереди
    // на отправку. Условие по статусу — не оптимизация, а защита: значение
    // срока хранения — годы, и до него письмо давно либо ушло, либо попало
    // в разбор руками (failed). Но если кто-то однажды заведёт короткий срок
    // или переотправку зависшего письма, обезличивание не должно вырвать
    // адрес у попытки, которая ещё идёт.
    //
    // Под запрос заведён частичный индекс outbound_mail_retention_idx —
    // та же причина, что у lead_retention_idx: обезличенные из выборки уходят
    // навсегда, и держать под них место в индексе незачем.
    List<OutboundMail> findByCreatedAtBeforeAndErasedAtIsNullAndStatusNot(
            Instant cutoff, String excludedStatus, Pageable page);
}
