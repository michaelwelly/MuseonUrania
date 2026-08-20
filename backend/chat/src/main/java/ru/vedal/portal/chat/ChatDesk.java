package ru.vedal.portal.chat;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.assistant.AssistantService;
import ru.vedal.portal.assistant.LlmEngine;
import ru.vedal.portal.audit.AuditLog;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import ru.vedal.portal.common.PageView;
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
// Как только разговор передан человеку, Ведалина замолкает. Не «отвечает реже»
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

        // Чат на сайте — открытый контур: посетитель, не сотрудник.
        var reply = assistant.ask(text, LlmEngine.Scope.PUBLIC, "public");

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

    /**
     * Лента разговора по ключу браузера. Разговора нет — пустая лента, а не отказ.
     *
     * <p>Чтение ленты и есть отметка прочтения: посетитель, открывший виджет,
     * увидел то, что там написано. Отдельной кнопки «прочитано» не бывает,
     * а отдельный запрос клиент может не отправить — на обрыве связи, на
     * закрытии вкладки, просто потому что его забыли позвать.
     */
    @Transactional
    public Thread threadFor(String visitorKey) {
        return conversations.findByVisitorKeyAndStatusNot(visitorKey, Conversation.CLOSED)
                .map(conversation -> {
                    // Посетитель читает то, что написали ему: ответы Ведалины
                    // и сотрудника. Свои сообщения он и так видел.
                    markRead(conversation, ChatMessage.VISITOR);
                    return thread(conversation);
                })
                .orElseGet(Thread::empty);
    }

    /**
     * Посетитель набирает текст.
     *
     * <p>Мимо базы и мимо транзакции: факт живёт секунды и интересен только
     * тому, кто смотрит в экран прямо сейчас. Записывать его значит писать
     * несколько раз на каждое сообщение ради того, что протухнет раньше,
     * чем доедет.
     */
    @Transactional(readOnly = true)
    public void typing(String visitorKey) {
        // Разговор ищется ради его идентификатора: на рабочем месте поток один
        // на все разговоры, и без него надпись некуда поставить. Запрос дешёвый
        // и редкий — виджет шлёт это раз в несколько секунд, а не на букву.
        conversations.findByVisitorKeyAndStatusNot(visitorKey, Conversation.CLOSED)
                .ifPresent(c -> stream.typing(c.getId(), visitorKey, ChatMessage.VISITOR));
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
    public PageView<Card> queue(int page, int size) {
        // PageView, а не Page из Spring Data: тот сериализуется вместе
        // с внутренностями пейджера, и контракт админки от них не зависит.
        // Так отдают списки все остальные двери админки.
        return PageView.of(conversations
                .findByStatusOrderByLastAtAsc(Conversation.WAITING, PageRequest.of(page, size)),
                this::card);
    }

    /** Все разговоры, последние сверху. */
    @Transactional(readOnly = true)
    public PageView<Card> all(int page, int size) {
        return PageView.of(
                conversations.findByOrderByLastAtDesc(PageRequest.of(page, size)), this::card);
    }

    /**
     * Лента разговора для сотрудника.
     *
     * <p>Открыв её, он прочитал написанное посетителем — и посетитель увидит
     * галочку. Это единственный честный момент: сотрудник смотрит в текст.
     */
    @Transactional
    public Thread threadOf(UUID id) {
        var conversation = find(id);
        markRead(conversation, ChatMessage.STAFF);
        return thread(conversation);
    }

    /** Сотрудник набирает ответ. Видит это только тот посетитель, кому он отвечает. */
    public void typingTo(UUID id) {
        conversations.findById(id)
                .ifPresent(c -> stream.typing(c.getId(), c.getVisitorKey(), ChatMessage.STAFF));
    }

    /**
     * Отметить прочитанным всё, что написано НЕ этой стороной.
     *
     * @param side кто читает: {@link ChatMessage#VISITOR} или {@link ChatMessage#STAFF}.
     *             Сотрудник читает сообщения посетителя, посетитель — ответы
     *             Ведалины и сотрудника.
     */
    private void markRead(Conversation conversation, String side) {
        var now = Instant.now();
        var changed = false;

        for (var message : messages.findByConversationIdOrderByAtAsc(conversation.getId())) {
            var mine = ChatMessage.VISITOR.equals(side)
                    ? ChatMessage.VISITOR.equals(message.getAuthor())
                    // Для сотрудника «своё» — и его ответ, и ответ Ведалины:
                    // она отвечает от имени портала, и галочка на её реплике
                    // означала бы, что портал прочитал сам себя.
                    : !ChatMessage.VISITOR.equals(message.getAuthor());

            if (mine || message.getReadAt() != null) continue;
            message.setReadAt(now);
            changed = true;
        }

        // Событие только если что-то изменилось: иначе каждое открытие ленты
        // будило бы всех подписчиков разговора без всякой причины, а виджет
        // на это перечитывает ленту — и будил бы снова.
        if (changed) {
            bus.publishEvent(new ChatStream.Changed(
                    conversation.getId(), conversation.getVisitorKey()));
        }
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
                .map(m -> new Line(m.getAuthor(), m.getActor(), m.getBody(),
                        deserialize(m.getSources()), m.getAt(), m.getReadAt()))
                .toList();
        return new Thread(conversation.getId(), conversation.getStatus(), list);
    }

    private String serialize(Object sources) {
        if (sources == null) return null;
        return json.writeValueAsString(sources);
    }

    /**
     * Источники ответа обратно из снимка.
     *
     * <p>Отдавать их обязательно: правило проекта — утверждение без ссылки
     * проверить нечем, и ответ Ведалины без источников это ответ, которому
     * нельзя верить. В базе они лежат снимком, потому что изделие могли
     * переименовать или снять с публикации, а переписка обязана остаться
     * такой, какой её видел человек.
     *
     * <p>Разбор не должен ронять чтение ленты: испорченный JSON в одной
     * строке — повод показать сообщение без ссылок, а не отказать в показе
     * всего разговора.
     */
    private List<LlmEngine.Source> deserialize(String sources) {
        if (sources == null || sources.isBlank()) return List.of();
        try {
            return List.of(json.readValue(sources, LlmEngine.Source[].class));
        } catch (RuntimeException e) {
            return List.of();
        }
    }

    public record Thread(UUID id, String status, List<Line> messages) {
        static Thread empty() {
            return new Thread(null, Conversation.OPEN, List.of());
        }
    }

    /**
     * Строка ленты.
     *
     * <p>{@code actor} у сотрудника — имя, которое видит посетитель. У Ведалины
     * и у самого посетителя пусто: подписывать машину именем человека нельзя,
     * а посетитель и так знает, что написал сам.
     */
    public record Line(String author, String actor, String body,
                       List<LlmEngine.Source> sources, Instant at,

                       /** Когда прочитано противоположной стороной. null — ещё нет. */
                       Instant readAt) {}
}
