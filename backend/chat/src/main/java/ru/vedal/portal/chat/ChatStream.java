package ru.vedal.portal.chat;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

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

    // Подписки посетителей индексируются ключом браузера, а не разговором,
    // и это не деталь. Виджет открывается раньше первого сообщения, то есть
    // раньше, чем разговор вообще заведён: по идентификатору разговора
    // подписаться в этот момент не на что. Ключ браузера у вкладки есть всегда.
    private final Map<String, List<SseEmitter>> byVisitor = new ConcurrentHashMap<>();
    private final List<SseEmitter> desks = new CopyOnWriteArrayList<>();

    /** Подписка посетителя. Разговора может ещё не быть — поток просто молчит. */
    public SseEmitter watch(String visitorKey) {
        var emitter = new SseEmitter(TIMEOUT);
        var subscribers = byVisitor.computeIfAbsent(visitorKey,
                key -> new CopyOnWriteArrayList<>());
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

    /** Подписка рабочего места: любое изменение в любом разговоре. */
    public SseEmitter watchAll() {
        var emitter = new SseEmitter(TIMEOUT);
        desks.add(emitter);
        forget(emitter, () -> desks.remove(emitter));
        return emitter;
    }

    private void forget(SseEmitter emitter, Runnable remove) {
        emitter.onCompletion(remove);
        emitter.onTimeout(remove);
        emitter.onError(e -> remove.run());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onChange(Changed event) {
        send(byVisitor.getOrDefault(event.visitorKey(), List.of()), event);
        send(desks, event);
    }

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
