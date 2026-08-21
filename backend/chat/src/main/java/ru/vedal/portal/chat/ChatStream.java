package ru.vedal.portal.chat;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import ru.vedal.portal.common.TooManyRequestsException;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

// Живая доставка: посетитель и сотрудник видят сообщение, не перезагружая
// страницу.
//
// ————— почему после COMMIT, а не в момент записи —————
//
// Событие рассылается в фазе AFTER_COMMIT, и это не перестраховка. Разослав
// его внутри транзакции, мы получаем гонку, которая воспроизводится тем чаще,
// чем быстрее сеть: клиент получает «в разговоре новое», идёт читать ленту
// отдельным запросом — и не находит там сообщения, потому что транзакция
// писавшего ещё не закоммичена. Со стороны это выглядит как пропавшее
// сообщение, которое «появляется, если обновить страницу».
//
// Вторая половина той же беды: транзакция может откатиться. Тогда разосланное
// событие сообщает о сообщении, которого не существует и не будет.
//
// ————— почему SSE, а не WebSocket —————
//
// Поток односторонний: сервер сообщает, что в разговоре появилось новое.
// Пишут обе стороны обычным POST. Для этого хватает обычного HTTP — SSE
// проходит через Caddy и шлюз без отдельной настройки и сам переподключается
// при обрыве, чего у WebSocket из коробки нет.
//
// ————— чего здесь нет —————
//
// В событии нет ни текста сообщения, ни автора — только «в этом разговоре
// что-то изменилось». Текст приезжает следующим запросом, который проходит
// проверку прав: сотрудник читает через админскую дверь, посетитель — по
// своему ключу. Положи мы тело в событие, и рассылка стала бы вторым местом,
// где решается, кому что видно.
//
// Подписки живут в памяти процесса. При втором экземпляре приложения
// подписчик одного экземпляра не увидит сообщение, записанное другим:
// понадобится общая шина. Пока экземпляр один — этого достаточно, и
// ограничение то же, что у лимита частоты.
@Component
public class ChatStream {

    private static final Logger log = LoggerFactory.getLogger(ChatStream.class);

    // Полчаса. Браузер переподключится сам, а вечный поток означает соединение,
    // которое никто никогда не закроет.
    private static final long TIMEOUT = 30 * 60 * 1000L;

    // ————— пределы —————
    //
    // Дверь потока открыта анониму и, в отличие от остальных публичных,
    // не стоит под лимитом частоты: лимит считает обращения, а здесь важно
    // не сколько раз обратились, а сколько соединений держат открытыми.
    // Каждое живёт полчаса и занимает поток обслуживания. Без предела
    // цикл из десяти строк складывает приложение, не превысив ни одного
    // счётчика.
    //
    // Четыре на ключ — это вкладки одного человека: сайт открыт в двух-трёх
    // и виджет в каждой. Пятая означает, что подписки не снимаются,
    // а не что человеку мало.
    private static final int PER_VISITOR = 4;

    // Пятьсот на всех: столько посетителей одновременно на сайте, где
    // за сутки бывает несколько десятков заявок, не бывает. Предел здесь
    // не про нагрузку, а про то, чтобы отказ пришёл раньше, чем кончатся
    // потоки обслуживания и вместе с ними весь портал.
    private static final int TOTAL_VISITORS = 500;

    // Рабочих мест столько же, сколько сотрудников, — с запасом на вкладки.
    // Этот предел вдобавок ограничивает размножение события «печатает»:
    // оно рассылается всем рабочим местам сразу.
    private static final int DESKS = 64;

    // Подписки посетителей индексируются ключом браузера, а не разговором,
    // и это не деталь. Виджет открывается раньше первого сообщения, то есть
    // раньше, чем разговор вообще заведён: по идентификатору разговора
    // подписаться в этот момент не на что. Ключ браузера у вкладки есть всегда.
    private final Map<String, List<SseEmitter>> byVisitor = new ConcurrentHashMap<>();
    private final List<SseEmitter> desks = new CopyOnWriteArrayList<>();


    /** Подписка посетителя. Разговора может ещё не быть — поток просто молчит. */
    public SseEmitter watch(String visitorKey) {
        var subscribers = byVisitor.computeIfAbsent(visitorKey,
                key -> new CopyOnWriteArrayList<>());

        // Отказ, а не молчаливое закрытие потока: виджет, получив пустой
        // ответ, переподключается — и упирается в предел снова, уже циклом.
        // 429 он понимает и ждёт.
        if (subscribers.size() >= PER_VISITOR || openStreams() >= TOTAL_VISITORS) {
            if (subscribers.isEmpty()) byVisitor.remove(visitorKey, subscribers);
            throw new TooManyRequestsException(
                    "Слишком много открытых окон чата. Закройте лишние вкладки.");
        }

        var emitter = new SseEmitter(TIMEOUT);
        subscribers.add(emitter);

        // Снятие подписки на всех трёх исходах. Без этого список растёт на
        // каждую открытую вкладку и не освобождается никогда, а рассылка
        // раз за разом пишет в закрытые соединения.
        forget(emitter, () -> {
            subscribers.remove(emitter);
            // Пустой список — тоже утечка: по ключу на каждую вкладку,
            // которую когда-либо открывали.
            if (subscribers.isEmpty()) byVisitor.remove(visitorKey, subscribers);
        });

        return emitter;
    }

    /**
     * Сколько соединений посетителей открыто сейчас.
     *
     * <p>Считается обходом, а не отдельным счётчиком, и это осознанный
     * размен. Счётчик рядом со списком — это второе место, где хранится
     * одно и то же, и расходятся они молча: контейнер объявляет и завершение,
     * и ошибку у одного соединения, снятие срабатывает дважды, счётчик уезжает
     * в минус — а предел вместе с ним вверх. Обнаружить это можно только тем,
     * что предела больше нет.
     *
     * <p>Обход стоит прохода по карте, размер которой ограничен этим же
     * пределом, и случается он на открытие вкладки, а не на сообщение.
     * Дешевле, чем ошибка, которую нечем поймать.
     */
    private int openStreams() {
        var open = 0;
        for (var subscribers : byVisitor.values()) {
            open += subscribers.size();
        }
        return open;
    }

    /**
     * Подписка рабочего места: любое изменение в любом разговоре.
     *
     * <p>Предел тот же по смыслу, но дверь за аутентификацией, и цикл
     * из десяти строк снаружи её не откроет. Он здесь ради второго:
     * событие «печатает» рассылается всем рабочим местам сразу, и число
     * подписок — это множитель у каждого нажатия клавиши посетителем.
     */
    public SseEmitter watchAll() {
        if (desks.size() >= DESKS) {
            throw new TooManyRequestsException(
                    "Слишком много открытых рабочих мест. Закройте лишние вкладки.");
        }

        var emitter = new SseEmitter(TIMEOUT);
        desks.add(emitter);
        forget(emitter, () -> desks.remove(emitter));
        return emitter;
    }

    private void forget(SseEmitter emitter, Runnable remove) {
        emitter.onCompletion(remove);
        emitter.onError(e -> remove.run());

        // По истечении срока поток надо ещё и ЗАКРЫТЬ, а не только снять
        // подписку. Не закрыв, мы оставляем асинхронный запрос висеть,
        // и Spring поднимает AsyncRequestTimeoutException, пытается ответить
        // на него 503 — а ответ давно отправлен, потому что по потоку уже
        // шли события. В журнале на каждое истёкшее соединение появляются
        // два предупреждения:
        //
        //   Resolved [AsyncRequestTimeoutException]
        //   Ignoring exception, response committed already
        //
        // Само по себе это не отказ: браузер переподключается, и посетитель
        // ничего не замечает. Но соединение живёт полчаса, а посетителей
        // на сайте десятки — журнал заполняется предупреждениями о штатном
        // событии, и настоящее предупреждение в нём становится незаметным.
        emitter.onTimeout(() -> {
            remove.run();
            emitter.complete();
        });
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onChange(Changed event) {
        send(byVisitor.getOrDefault(event.visitorKey(), List.of()), event);
        send(desks, event);
    }

    /**
     * Кто-то набирает текст.
     *
     * <p>Идёт мимо транзакционной шины намеренно — транзакции здесь нет и быть
     * не должно. Ничего не записывается: факт живёт секунды, и AFTER_COMMIT
     * ждал бы коммита, которого не будет.
     *
     * <p>Уходит только противоположной стороне. Отправить обеим значило бы
     * показать человеку «вы печатаете» — сообщение, которое он и так знает,
     * и которое в ленте выглядит как чужое.
     *
     * @param who {@link ChatMessage#VISITOR} или {@link ChatMessage#STAFF}.
     */
    public void typing(UUID conversationId, String visitorKey, String who) {
        var addressees = ChatMessage.VISITOR.equals(who)
                ? desks
                : byVisitor.getOrDefault(visitorKey, List.of());

        // Идентификатор разговора обязателен: на рабочем месте поток один
        // на все разговоры, и «кто-то печатает» без указания кто — надпись,
        // которую некуда поставить. Посетителю он не нужен (разговор у него
        // один), но событие одно на обе стороны: два формата ради экономии
        // одного поля разошлись бы при первой же правке.
        for (var emitter : addressees) {
            try {
                emitter.send(SseEmitter.event()
                        .name("typing")
                        .data(new Typing(conversationId, who)));
            } catch (IOException | IllegalStateException e) {
                emitter.completeWithError(e);
            }
        }
    }

    /** Кто печатает и в каком разговоре. В базе не хранится: живёт секунды. */
    public record Typing(UUID conversationId, String who) {}

    private void send(List<SseEmitter> subscribers, Changed event) {
        for (var emitter : subscribers) {
            try {
                emitter.send(SseEmitter.event().name("changed").data(event.conversationId()));
            } catch (IOException | IllegalStateException e) {
                // Обычное дело: вкладку закрыли, соединение оборвалось.
                // Отправка остальным продолжается — иначе один отвалившийся
                // подписчик лишает сообщения всех, кто идёт за ним в списке.
                emitter.completeWithError(e);
                log.debug("Подписчик разговора {} отвалился: {}",
                        event.conversationId(), e.toString());
            }
        }
    }

    /**
     * «В этом разговоре что-то изменилось». Ни текста, ни автора — намеренно.
     *
     * <p>Ключ браузера здесь нужен для адресации: по нему находятся подписки
     * посетителя, открытые до того, как разговор был заведён.
     */
    public record Changed(UUID conversationId, String visitorKey) {}
}
