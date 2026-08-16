package ru.vedal.portal.chat;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.assistant.AssistantService;
import ru.vedal.portal.audit.AuditLog;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Сторона посетителя: он пишет, ему отвечают.
//
// ————— главное правило —————
//
// Как только разговор передан человеку, Урания замолкает. Не «отвечает реже»
// и не «отвечает, пока сотрудник не подключился» — замолкает совсем.
//
// Иначе получается разговор, в котором машина перебивает человека: сотрудник
// пишет «сейчас уточню у инженера», посетитель отвечает «хорошо, жду»,
// и на это «хорошо, жду» ассистент выдаёт справку по каталогу. Со стороны
// посетителя это выглядит так, будто сотрудник не читает, что ему пишут.
//
// ————— чего здесь нет —————
//
// Тела сообщений не уходят в журнал аудита. Посетитель волен написать в
// свободное поле что угодно, включая своё имя и телефон, — а журнал неизменяем,
// и вычистить оттуда персональные данные по обращению уже нельзя. В журнал
// идёт только то, что произошло, и идентификатор разговора.
@Service
public class ChatDesk {

    private final ConversationRepository conversations;
    private final ChatMessageRepository messages;
    private final AssistantService assistant;
    private final AuditLog audit;
    private final ObjectMapper json;

    public ChatDesk(ConversationRepository conversations, ChatMessageRepository messages,
                    AssistantService assistant, AuditLog audit, ObjectMapper json) {
        this.conversations = conversations;
        this.messages = messages;
        this.assistant = assistant;
        this.audit = audit;
        this.json = json;
    }

    /** Откуда пришёл посетитель. Снимается при первом сообщении и больше не меняется. */
    public record Context(String language, String campaign, String page) {}

    /**
     * Посетитель написал.
     *
     * @return вся лента разговора — виджет рисует её целиком, а не дописывает
     *         к тому, что у него уже было. Дописывание требует, чтобы клиент
     *         и сервер одинаково понимали, где кончилось прошлое состояние,
     *         а при обрыве связи они это понимают по-разному.
     */
    @Transactional
    public Thread say(String visitorKey, String text, Context context) {
        var conversation = openFor(visitorKey, context);
        append(conversation, ChatMessage.VISITOR, null, text, null);

        // Человек в разговоре — ассистенту здесь делать нечего.
        if (conversation.handedToHuman()) return thread(conversation);

        var reply = assistant.ask(text);

        if (reply.handoff() != null) {
            // Ответа нет — это штатный исход, а не ошибка: правило «нет
            // подходящих опубликованных источников — нет ответа» сильнее
            // желания что-нибудь сказать. Разговор встаёт в очередь к человеку.
            append(conversation, ChatMessage.ASSISTANT, null, reply.answer(), null);
            conversation.setStatus(Conversation.WAITING);
            audit.record("public", "chat.handoff", "conversation",
                    conversation.getId().toString(),
                    Map.of("reason", reply.handoff().reason()));
        } else {
            append(conversation, ChatMessage.ASSISTANT, null, reply.answer(),
                    serialize(reply.sources()));
        }

        return thread(conversation);
    }

    /** Лента разговора по ключу браузера. Разговора нет — пустая лента, а не отказ. */
    @Transactional(readOnly = true)
    public Thread threadFor(String visitorKey) {
        return conversations.findByVisitorKeyAndStatusNot(visitorKey, Conversation.CLOSED)
                .map(this::thread)
                .orElseGet(Thread::empty);
    }

    private Conversation openFor(String visitorKey, Context context) {
        return conversations.findByVisitorKeyAndStatusNot(visitorKey, Conversation.CLOSED)
                .orElseGet(() -> start(visitorKey, context));
    }

    private Conversation start(String visitorKey, Context context) {
        var conversation = new Conversation();
        conversation.setId(UUID.randomUUID());
        conversation.setVisitorKey(visitorKey);
        // Атрибуция снимается при первом сообщении: язык страницы и кампания —
        // свойство того, откуда человек пришёл, и позже взять их уже неоткуда.
        conversation.setLanguage(context.language());
        conversation.setCampaign(context.campaign());
        conversation.setPage(context.page());

        var started = conversations.save(conversation);
        audit.record("public", "chat.started", "conversation", started.getId().toString(),
                Map.of("source", "widget"));
        return started;
    }

    private void append(Conversation conversation, String author, String actor,
                        String body, String sources) {
        var message = new ChatMessage();
        message.setId(UUID.randomUUID());
        message.setConversationId(conversation.getId());
        message.setAuthor(author);
        message.setActor(actor);
        message.setBody(body);
        message.setSources(sources);
        messages.save(message);

        conversation.setLastAt(Instant.now());
    }

    private Thread thread(Conversation conversation) {
        var list = messages.findByConversationIdOrderByAtAsc(conversation.getId()).stream()
                .map(m -> new Line(m.getAuthor(), m.getActor(), m.getBody(), m.getAt()))
                .toList();
        return new Thread(conversation.getId(), conversation.getStatus(), list);
    }

    private String serialize(Object sources) {
        if (sources == null) return null;
        return json.writeValueAsString(sources);
    }

    public record Thread(UUID id, String status, List<Line> messages) {
        static Thread empty() {
            return new Thread(null, Conversation.OPEN, List.of());
        }
    }

    /**
     * Строка ленты.
     *
     * <p>{@code actor} у сотрудника — имя, которое видит посетитель. У Урании
     * и у самого посетителя пусто: подписывать машину именем человека нельзя,
     * а посетитель и так знает, что написал сам.
     */
    public record Line(String author, String actor, String body, Instant at) {}
}
