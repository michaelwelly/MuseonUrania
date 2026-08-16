package ru.vedal.portal.chat;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    // Открытый разговор у ключа один — это закреплено частичным уникальным
    // индексом conversation_visitor_open_idx. Второй означал бы, что посетитель
    // пишет в одно окно, а сотрудник отвечает в другое.
    Optional<Conversation> findByVisitorKeyAndStatusNot(String visitorKey, String status);

    // Очередь сотрудника: кто ждёт живого ответа дольше всех. Сортировка
    // по возрастанию времени последнего сообщения — первым тот, кто ждёт дольше.
    Page<Conversation> findByStatusOrderByLastAtAsc(String status, Pageable pageable);

    Page<Conversation> findByOrderByLastAtDesc(Pageable pageable);
}
