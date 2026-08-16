package ru.vedal.portal.chat;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.assistant.AssistantService;
import ru.vedal.portal.audit.AuditLog;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import ru.vedal.portal.common.NotFoundException;
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
    private final ApplicationEventPublisher bus;
    private final ChatStream stream;

    public ChatDesk(ConversationRepository conversations, ChatMessageRepository messages,
                    AssistantService assistant, AuditLog audit, ObjectMapper json,
                    ApplicationEventPublisher bus, ChatStream stream) {
        this.conversations = conversations;
        this.messages = messages;
        this.assistant = assistant;
        this.audit = audit;
        this.json = json;
        this.bus = bus;
        this.stream = stream;
    }

    /**
     * Подписка посетителя на свой разговор.
     *
     * <p>Разговора ещё нет — поток всё равно открывается и молчит. Виджет может
     * подписаться до первого сообщения, и отказ здесь означал бы, что он сам
     * должен догадываться, когда подписываться, и переподписываться после
     * первой же отправки.
     */
    public SseEmitter watch(String visitorKey) {
        return stream.watch(visitorKey);
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

    // ————— сторона сотрудника —————

    /**
     * Очередь: кто ждёт живого ответа, дольше ждущие первыми.
     *
     * <p>Отдельный метод, а не фильтр в общем списке, потому что это разные
     * вопросы. «Что вообще происходит» — обзор; «кому надо ответить прямо
     * сейчас» — работа. Смешав их, получаем список, в котором закрытые
     * разговоры недельной давности стоят вперемешку с ждущими.
     */
    @Transactional(readOnly = true)
    public Page<Card> queue(int page, int size) {
        return conversations
                .findByStatusOrderByLastAtAsc(Conversation.WAITING, PageRequest.of(page, size))
                .map(this::card);
    }

    /** Все разговоры, последние сверху. */
    @Transactional(readOnly = true)
    public Page<Card> all(int page, int size) {
        return conversations.findByOrderByLastAtDesc(PageRequest.of(page, size)).map(this::card);
    }

    @Transactional(readOnly = true)
    public Thread threadOf(UUID id) {
        return thread(find(id));
    }

    /**
     * Сотрудник ответил.
     *
     * <p>Ответ и есть взятие разговора: отдельной кнопки «взять» нет намеренно.
     * Взятый, но не отвеченный разговор — это разговор, который пропал из
     * очереди и по которому никто не написал; посетитель ждёт ровно так же,
     * как ждал, а система считает, что им занимаются.
     */
    @Transactional
    public Thread reply(UUID id, String actor, String text) {
        var conversation = find(id);

        append(conversation, ChatMessage.STAFF, actor, text, null);
        conversation.setOwner(actor);
        conversation.setStatus(Conversation.ATTENDED);

        audit.record(actor, "chat.replied", "conversation", id.toString(), Map.of());
        return thread(conversation);
    }

    /** Разговор закончен. Посетитель, написав снова, заведёт новый. */
    @Transactional
    public void close(UUID id, String actor) {
        var conversation = find(id);
        conversation.setStatus(Conversation.CLOSED);
        // Владелец остаётся: «закрыт неизвестно кем» бесполезно при разборе.
        if (conversation.getOwner() == null) conversation.setOwner(actor);

        audit.record(actor, "chat.closed", "conversation", id.toString(), Map.of());
        bus.publishEvent(new ChatStream.Changed(id, conversation.getVisitorKey()));
    }

    private Conversation find(UUID id) {
        return conversations.findById(id)
                .orElseThrow(() -> new NotFoundException("Разговор не найден"));
    }

    private Card card(Conversation c) {
        return new Card(c.getId(), c.getStatus(), c.getOwner(), c.getLanguage(),
                c.getCampaign(), c.getPage(), c.getStartedAt(), c.getLastAt());
    }

    /** Строка списка разговоров. Без текста: список читают глазами, а не вчитываются. */
    public record Card(UUID id, String status, String owner, String language,
                       String campaign, String page, Instant startedAt, Instant lastAt) {}

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

        // Рассылка объявляется здесь, а не в вызывающих: сообщение, о котором
        // забыли сообщить, — это сообщение, которое собеседник увидит только
        // после перезагрузки страницы. Забыть строку в одном из трёх мест
        // легко, в одном — некуда.
        //
        // Само событие уйдёт подписчикам после COMMIT: разослав его сейчас,
        // мы отправили бы читателя за сообщением, которого он ещё не увидит.
        bus.publishEvent(new ChatStream.Changed(conversation.getId(), conversation.getVisitorKey()));
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
