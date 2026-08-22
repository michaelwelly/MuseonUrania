package ru.vedal.portal.chat;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    // Лента читается по порядку и только так: под это заведён индекс
    // chat_message_thread_idx (conversation_id, at).
    List<ChatMessage> findByConversationIdOrderByAtAsc(UUID conversationId);

    // Непрочитанное этого разговора. Под этот запрос V19 завела частичный
    // индекс chat_message_unread_idx (conversation_id, author) where read_at
    // is null — и до сих пор им никто не пользовался: отметку ставили,
    // пройдя всю ленту и отфильтровав в памяти.
    //
    // Разница не в красоте. Отметка ставится на КАЖДОЕ открытие ленты,
    // а виджет перечитывает её на каждое событие из потока. Проход по всей
    // переписке ради двух новых строк — это работа, которая растёт вместе
    // с разговором и повторяется тем чаще, чем живее разговор идёт.
    //
    // Автор здесь не в запросе, а отбирается вызывающим: у сторон он разный
    // («не я» для посетителя — это Ведалина и сотрудник, для сотрудника —
    // только посетитель), а непрочитанных в разговоре единицы.
    List<ChatMessage> findByConversationIdAndReadAtIsNull(UUID conversationId);
}
