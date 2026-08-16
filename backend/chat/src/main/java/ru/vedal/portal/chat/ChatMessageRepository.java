package ru.vedal.portal.chat;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    // Лента читается по порядку и только так: под это заведён индекс
    // chat_message_thread_idx (conversation_id, at).
    List<ChatMessage> findByConversationIdOrderByAtAsc(UUID conversationId);
}
