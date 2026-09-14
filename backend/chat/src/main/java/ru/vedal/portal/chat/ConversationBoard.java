package ru.vedal.portal.chat;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.PageView;
import ru.vedal.portal.common.NotFoundException;
import org.springframework.context.ApplicationEventPublisher;
import java.time.Instant;
import java.util.*;

@Service
public class ConversationBoard {
    public static final Set<String> STAGES = Set.of("new", "clarification", "selection", "ready_for_quote", "handed_to_human", "closed");
    public static final Set<String> IMPORTANCE = Set.of("normal", "high", "urgent");
    private final ConversationRepository conversations;
    private final ChatMessageRepository messages;
    private final AuditLog audit;
    private final ApplicationEventPublisher bus;

    public ConversationBoard(ConversationRepository conversations, ChatMessageRepository messages,
                             AuditLog audit, ApplicationEventPublisher bus) {
        this.conversations = conversations; this.messages = messages; this.audit = audit; this.bus = bus;
    }

    public record Row(UUID id, String summary, String stage, String owner, String importance,
                      String nextAction, Instant updatedAt, boolean manual, long version) {
        static Row of(Conversation c) {
            return new Row(c.getId(), c.getSummary(), c.getStage(), c.getOwner(), c.getImportance(),
                    c.getNextAction(), c.getBoardUpdatedAt(), c.isBoardManual(), c.getVersion());
        }
    }
    public record Edit(String summary, String stage, String owner, String importance,
                       String nextAction, boolean manual, long version) {}

    @Transactional(readOnly = true)
    public PageView<Row> list(String stage, String owner, String importance, int page, int size) {
        return PageView.of(conversations.board(blank(stage), blank(owner), blank(importance),
                PageRequest.of(Math.max(0, page), Math.clamp(size, 1, 100))), Row::of);
    }

    @Transactional
    public Row update(UUID id, Edit edit, String actor) {
        var c = conversations.findById(id).filter(v -> v.getErasedAt() == null)
                .orElseThrow(() -> new NotFoundException("Разговор не найден"));
        if (c.getVersion() != edit.version())
            throw new org.springframework.orm.ObjectOptimisticLockingFailureException(Conversation.class, id);
        if (!STAGES.contains(edit.stage()) || !IMPORTANCE.contains(edit.importance()))
            throw new IllegalArgumentException("Неизвестная стадия или важность");
        c.setSummary(edit.summary().trim()); c.setStage(edit.stage()); c.setOwner(blank(edit.owner()));
        c.setImportance(edit.importance()); c.setNextAction(edit.nextAction().trim()); c.setBoardManual(edit.manual());
        if (!edit.manual()) {
            c.setSummary(""); c.setStage("new"); c.setImportance("normal"); c.setNextAction("Уточнить задачу посетителя");
            for (var m : messages.findByConversationIdOrderByAtAsc(id)) project(c, m.getAuthor(), m.getBody());
            c.setStatus(c.getStatus());
        }
        c.setBoardUpdatedAt(Instant.now());
        audit.record(actor, "chat.board.edited", "conversation", id.toString(),
                Map.of("stage", c.getStage(), "importance", c.getImportance(), "manual", String.valueOf(edit.manual())));
        conversations.flush();
        bus.publishEvent(new ChatStream.Changed(id, c.getVisitorKey()));
        return Row.of(c);
    }

    // Extractive projection: only visitor facts, no invented commitments or LLM calls.
    static boolean project(Conversation c, String author, String body) {
        if (c.isBoardManual() || c.getErasedAt() != null || !ChatMessage.VISITOR.equals(author)) return false;
        String text = body.strip().replaceAll("\\s+", " ");
        if (text.length() < 12 || text.matches("(?iu)(здравствуйте|добрый день|спасибо( большое)?|добрый вечер)[.! ]*")) return false;
        c.setSummary(text.substring(0, Math.min(text.length(), 600)));
        String lower = text.toLowerCase(Locale.ROOT);
        if (lower.matches(".*(срочно|сегодня|горит).*")) c.setImportance("urgent");
        if (!c.handedToHuman() && !Conversation.CLOSED.equals(c.getStatus())) {
            if (lower.matches(".*(подберите|подобрать|подбор|сравнить).*")) {
                c.setStage("selection"); c.setNextAction("Подобрать оборудование и уточнить комплектацию");
            } else if ("new".equals(c.getStage())) {
                c.setStage("clarification"); c.setNextAction("Уточнить требования и контакты");
            }
        }
        c.setBoardUpdatedAt(Instant.now());
        return true;
    }
    private static String blank(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
