package ru.vedal.portal.chat;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.assistant.AskReply;
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
import java.util.Optional;
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

    private static final int MAX_PAGE_SIZE = 200;

    // Сколько переписки уходит в тело заявки. Четыре тысячи знаков — это
    // примерно тридцать реплик: разговор длиннее в заявке всё равно не читают,
    // а полная переписка остаётся в разговоре, на который заявка ссылается.
    private static final int MAX_TRANSCRIPT = 4000;

    private final ConversationRepository conversations;
    private final ChatMessageRepository messages;
    private final AssistantService assistant;
    private final AuditLog audit;
    private final ObjectMapper json;
    private final ApplicationEventPublisher bus;
    private final ChatStream stream;
    private final SupportHours hours;

    public ChatDesk(ConversationRepository conversations, ChatMessageRepository messages,
                    AssistantService assistant, AuditLog audit, ObjectMapper json,
                    ApplicationEventPublisher bus, ChatStream stream, SupportHours hours) {
        this.conversations = conversations;
        this.messages = messages;
        this.assistant = assistant;
        this.audit = audit;
        this.json = json;
        this.bus = bus;
        this.stream = stream;
        this.hours = hours;
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
        return say(visitorKey, text, null, context);
    }

    /**
     * Посетитель написал или нажал кнопку.
     *
     * @param intent какую кнопку нажали. Пусто — человек напечатал сам,
     *               и вопрос идёт обычным путём. Заготовка выбирается
     *               по намерению, а не по совпадению с подписью кнопки:
     *               подпись живёт в интерфейсе и меняется вместе с ним.
     */
    @Transactional
    public Thread say(String visitorKey, String text, String intent, Context context) {
        var conversation = openFor(visitorKey, context);
        append(conversation, ChatMessage.VISITOR, null, text, null);

        // Человек в разговоре — ассистенту здесь делать нечего.
        if (conversation.handedToHuman()) return thread(conversation);

        // Кнопка — известный вопрос с известным ответом. В поиск он не идёт:
        // именно там «Запросить КП» превращалось в список изделий, у которых
        // в описании нашлось похожее слово.
        //
        // Отвечается сразу, а не отдельным шагом: текст известен заранее,
        // и откладывать его значит показывать раздумье над решением, которое
        // принято до нажатия кнопки.
        var canned = assistant.scripted(intent, "public");
        if (canned.isPresent()) {
            append(conversation, ChatMessage.ASSISTANT, null, canned.get().answer(), null);
            return thread(conversation);
        }

        // ————— свободный вопрос отвечается отдельно —————
        //
        // Раньше движок вызывался прямо здесь, и ответ уходил в теле того же
        // запроса. С детерминированным поиском это незаметно: он считает за
        // миллисекунды. С моделью тот же код означает запрос, висящий десять
        // секунд, — и три беды разом.
        //
        // Первая: посетитель всё это время смотрит в неподвижное окно. Точки
        // «печатает» рисовал сам виджет и гасил их на любой перезагрузке —
        // то есть надпись пропадала ровно тогда, когда человек начинал
        // сомневаться, дошёл ли вопрос.
        //
        // Вторая: между виджетом и порталом стоят Caddy и шлюз, и у них свои
        // сроки ожидания. Ответ, не поспевший к сроку, теряется для посетителя
        // и остаётся записанным в базе — то есть виджет показывает ошибку
        // на вопрос, ответ на который есть.
        //
        // Третья: HTTP-запрос занимает поток обслуживания. Десять секунд
        // на вопрос — и десяток посетителей занимает их все.
        //
        // Поэтому дверь возвращает ленту сразу, с одним лишь вопросом
        // посетителя, а ответ доезжает рассылкой. Кто его считает —
        // {@link Answering}.
        bus.publishEvent(new Asked(conversation.getId(), visitorKey, text));
        return thread(conversation);
    }

    /**
     * Вопрос принят, ответа ещё нет.
     *
     * <p>Событие внутрипроцессное и уходит после COMMIT: считающий ответ
     * работает в другом потоке и своей транзакцией, а разговора, записанного
     * незакоммиченной транзакцией, он там не увидит.
     *
     * <p>Текст вопроса едет в событии, а не вычитывается из ленты по разговору.
     * «Последнее сообщение посетителя» — не то же самое, что «вопрос, ради
     * которого это событие»: посетитель волен написать второй раз, пока
     * считается ответ на первый.
     */
    public record Asked(UUID conversationId, String visitorKey, String question) {}

    /**
     * Ведалина ответила.
     *
     * <p>Отдельная дверь, а не продолжение {@link #say}: вызывается из другого
     * потока, когда транзакция приёма давно закрыта.
     */
    @Transactional
    public void answered(UUID conversationId, AskReply reply) {
        var conversation = find(conversationId);

        // Пока считался ответ, разговор мог уйти к человеку: посетитель нажал
        // «позвать специалиста», сотрудник взял разговор из очереди. Правило
        // «человек в разговоре — Ведалина молчит» сильнее того, что ответ
        // уже готов: готовый ответ здесь ничем не отличается от ответа,
        // написанного поверх реплики сотрудника.
        if (conversation.handedToHuman()) return;

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
    }

    /**
     * Ответ не сложился: движок недоступен, очередь переполнена, что угодно.
     *
     * <p>Молчание здесь недопустимо. Посетитель задал вопрос и видит точки;
     * не написав ничего, мы оставляем его ждать ответа, которого никто
     * не готовит, — и он уйдёт, решив, что чат сломан. Разговор встаёт
     * в очередь к человеку: это ровно тот случай, для которого очередь есть.
     *
     * <p>Причина в журнале отличается от «нет источников» и от «попросил сам».
     * Свалив их в одно, разбор качества ответов посчитал бы отказ движка
     * за вопрос не по теме.
     */
    @Transactional
    public void answerFailed(UUID conversationId) {
        var conversation = find(conversationId);
        if (conversation.handedToHuman()) return;

        append(conversation, ChatMessage.ASSISTANT, null,
                callingHuman().answer(), null);
        conversation.setStatus(Conversation.WAITING);
        audit.record("public", "chat.handoff", "conversation",
                conversationId.toString(), Map.of("reason", "failed"));
    }

    /**
     * Посетитель позвал живого человека.
     *
     * <p>До этой двери попасть к сотруднику можно было единственным способом:
     * задать вопрос, на который Ведалина не найдёт ответа. То есть человека
     * получал тот, кому не повезло, а не тот, кто его попросил. Кнопка
     * «Специалист VEDAL» при этом в виджете была — и отправляла свою
     * подпись в поиск, который отвечал на неё каталогом.
     *
     * <p>Повторное нажатие ничего не меняет и второго сообщения не пишет:
     * посетитель, нажавший дважды, не должен видеть «зову специалиста»
     * два раза, а очередь — считать это двумя обращениями.
     */
    @Transactional
    public Thread callHuman(String visitorKey, Context context) {
        var conversation = openFor(visitorKey, context);
        if (conversation.handedToHuman()) return thread(conversation);

        append(conversation, ChatMessage.ASSISTANT, null,
                callingHuman().answer(), null);
        conversation.setStatus(Conversation.WAITING);

        // Причина отличается от той, что пишется при отсутствии источников:
        // «asked» — посетитель попросил сам. Свалив их в одно, разбор качества
        // ответов посчитал бы просьбы о человеке за провалы ассистента.
        audit.record("public", "chat.handoff", "conversation",
                conversation.getId().toString(), Map.of("reason", "asked"));

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
                // Разговора нет — лента пуста, но про людей сказать есть что:
                // виджет открывают до первого сообщения, и надпись в шапке
                // нужна ему уже тогда.
                .orElseGet(() -> Thread.empty(support()));
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

    // ————— разговор, доросший до заявки —————

    /**
     * Разговор и его переписка одним куском — для заявки, которую из него заводят.
     *
     * <p><b>Почему здесь, а не в приёме заявок.</b> `chat` и `crm` друг о друге
     * не знают намеренно: заявка приходит и без разговора (форма, письмо),
     * а разговор не обязан дорасти до заявки. Сшивает их тот, кто зависит
     * от обоих, — админская дверь и дверь приёма. Отсюда наружу уходит текст,
     * а не знание о заявке.
     *
     * <p>Переписка нужна в теле заявки целиком. Менеджер, открывший заявку
     * «перезвоните», без неё видит одну эту строку — а вопрос, ради которого
     * человек пришёл, остался в разговоре, до которого ещё надо догадаться
     * дойти.
     */
    @Transactional(readOnly = true)
    public Optional<Transcript> transcriptFor(String visitorKey) {
        return conversations.findByVisitorKeyAndStatusNot(visitorKey, Conversation.CLOSED)
                .map(c -> new Transcript(c.getId(), transcript(c.getId())));
    }

    /**
     * Переписка разговора текстом.
     *
     * <p>С конца, а не с начала: обрезанный хвост — это последние сообщения,
     * ради которых заявку и завели, а обрезанное начало — приветствие.
     */
    private String transcript(UUID conversationId) {
        var lines = messages.findByConversationIdOrderByAtAsc(conversationId).stream()
                .map(m -> switch (m.getAuthor()) {
                    case ChatMessage.VISITOR -> "Посетитель: " + m.getBody();
                    case ChatMessage.STAFF -> (m.getActor() == null ? "Сотрудник" : m.getActor())
                            + ": " + m.getBody();
                    default -> "Ведалина: " + m.getBody();
                })
                .toList();

        var text = String.join("\n\n", lines);
        return text.length() <= MAX_TRANSCRIPT
                ? text
                : "…\n\n" + text.substring(text.length() - MAX_TRANSCRIPT);
    }

    /** Разговор вместе с его перепиской. */
    public record Transcript(UUID conversationId, String text) {}

    /**
     * Разговор стал заявкой.
     *
     * <p>Номер говорится вслух и пишется в ленту: это единственное, что
     * посетитель унесёт с собой. Личного кабинета у него нет, ссылке
     * «перейти к обращению» вести некуда — и придумывать её нельзя.
     *
     * <p>Разговор при этом не закрывается и не уходит в очередь: заявка —
     * не конец разговора, а его результат. Человек, оставивший контакты,
     * волен спросить дальше, и отвечать ему будут здесь же.
     */
    @Transactional
    public Thread leadRaised(UUID conversationId, UUID leadId, String number) {
        var conversation = find(conversationId);

        // Повторное нажатие: заявка та же (ключ повтора — разговор), и второе
        // сообщение о ней в ленте выглядело бы как второе обращение.
        if (conversation.getLeadId() != null) return thread(conversation);

        conversation.setLeadId(leadId);
        conversation.setLeadNumber(number);
        append(conversation, ChatMessage.ASSISTANT, null,
                "Обращение принято, номер " + number + ". Подтверждение отправлено на почту. "
                        + "Специалист ответит здесь же, в этом окне.", null);

        audit.record("public", "chat.lead", "conversation", conversationId.toString(),
                Map.of("lead", leadId.toString()));

        return thread(conversation);
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
                .findByStatusOrderByLastAtAsc(Conversation.WAITING, page(page, size)),
                this::card);
    }

    /**
     * Все разговоры, последние сверху.
     *
     * <p>Ответственный — необязательный отбор; «-» означает «никто не взял».
     * В очереди такого отбора нет и не будет: там по определению лежат
     * разговоры, которых ещё никто не взял, и фильтр по ответственному
     * отвечал бы на вопрос, ответ на который известен заранее.
     */
    @Transactional(readOnly = true)
    public PageView<Card> all(String owner, int page, int size) {
        return PageView.of(conversations.filter(
                owner == null || owner.isBlank() ? null : owner.trim(), page(page, size)),
                this::card);
    }

    // Страница списка. Границы здесь, а не в контроллере: PageRequest.of
    // падает на отрицательной странице, а размер без верхней границы
    // превращает «?size=1000000» в выгрузку всей таблицы разговоров одним
    // запросом. Остальные списки админки давно так и делают — этот отстал.
    private static PageRequest page(int page, int size) {
        return PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, MAX_PAGE_SIZE));
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

        // Только непрочитанное: по частичному индексу, заведённому под это
        // ещё в V19. Проход по всей ленте повторялся на каждое открытие
        // виджета, а виджет открывает её на каждое событие из потока.
        for (var message : messages.findByConversationIdAndReadAtIsNull(conversation.getId())) {
            var mine = ChatMessage.VISITOR.equals(side)
                    ? ChatMessage.VISITOR.equals(message.getAuthor())
                    // Для сотрудника «своё» — и его ответ, и ответ Ведалины:
                    // она отвечает от имени портала, и галочка на её реплике
                    // означала бы, что портал прочитал сам себя.
                    : !ChatMessage.VISITOR.equals(message.getAuthor());

            if (mine) continue;
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
        return new Thread(conversation.getId(), conversation.getStatus(), list,
                stream.answering(conversation.getId()), conversation.getLeadNumber(), support());
    }

    /**
     * Что Ведалина говорит, зовя человека.
     *
     * <p>Разное в зависимости от того, есть ли кто-то на связи. Разговор,
     * поставленный в очередь в полночь, ждёт до утра, и «ответ придёт в это
     * же окно» человек прочтёт как «сейчас ответят»: он закроет вкладку
     * через десять минут и решит, что чат не работает.
     *
     * <p>Смотрим на факт присутствия, а не только на расписание: сотрудник
     * бывает на связи и в неурочный час, а в рабочее время может отойти.
     * Часы называются тогда, когда на связи никого, — чтобы «сейчас никого
     * нет» не читалось как «здесь никого не бывает».
     */
    private AskReply callingHuman() {
        return stream.staffOnline()
                ? assistant.callingHuman()
                : assistant.callingHumanAfterHours(hours.description());
    }

    /** Отвечают ли сейчас люди — факт присутствия плюс часы работы. */
    private Support support() {
        return new Support(stream.staffOnline(), hours.openNow(), hours.description());
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

    public record Thread(UUID id, String status, List<Line> messages,

                        /**
                         * Ведалина думает над ответом прямо сейчас.
                         *
                         * <p>В ленте, а не только в событии рассылки, потому что
                         * событие уходит один раз — и мимо того, кто подписался
                         * позже. Виджет, открытый заново посреди ожидания,
                         * обязан снова показать точки: без них окно выглядит
                         * так, будто вопрос не дошёл, а он дошёл и на него
                         * отвечают.
                         */
                        boolean answering,

                        /**
                         * Номер заявки, заведённой из этого разговора. Пусто —
                         * разговор до заявки не дорос.
                         *
                         * <p>Номер, а не признак «заявка есть»: посетителю нужен
                         * именно он — по нему он позвонит, найдёт письмо
                         * и вернётся к разговору через неделю.
                         */
                        String leadNumber,

                        /**
                         * Отвечают ли сейчас люди — и когда отвечают вообще.
                         *
                         * <p>В ленте, а не отдельной дверью: виджет и так
                         * читает ленту при каждом открытии, а лишняя дверь
                         * означала бы второй запрос ради двух полей.
                         */
                        Support support) {

        static Thread empty(Support support) {
            return new Thread(null, Conversation.OPEN, List.of(), false, null, support);
        }
    }

    /**
     * Что сказать посетителю про живых людей.
     *
     * <p>Два признака, а не один, и это не избыточность. «Никого нет
     * в 23:00» и «никого нет в 11:00 вторника» — разные новости: в первом
     * случае человеку надо назвать часы и предложить обращение, во втором
     * специалист вот-вот подключится, и ждать имеет смысл.
     *
     * @param online    кто-то из специалистов на связи прямо сейчас. Факт:
     *                  открытое рабочее место означает, что человек смотрит
     *                  в экран. Расписание такого не обещает.
     * @param openNow   рабочее ли сейчас время по расписанию поддержки.
     * @param hours     часы работы одной строкой — что показать, когда никого нет.
     */
    public record Support(boolean online, boolean openNow, String hours) {}

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
