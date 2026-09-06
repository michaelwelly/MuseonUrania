package ru.vedal.portal.chat;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import ru.vedal.portal.assistant.AssistantService;
import ru.vedal.portal.assistant.LlmEngine;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Кто считает ответ Ведалины и когда.
 *
 * <p><b>Зачем это отдельно от разговора.</b> Приём вопроса и ответ на него —
 * разные события во времени, и раньше это было незаметно: детерминированный
 * поиск считает за миллисекунды, поэтому ответ помещался в тот же HTTP-запрос.
 * Модель считает секундами, и тот же код превращается в запрос, висящий
 * десять секунд, — с неподвижным окном у посетителя, сроком ожидания
 * у Caddy и занятым потоком обслуживания.
 *
 * <p><b>Почему после COMMIT.</b> Задача уходит в другой поток и работает своей
 * транзакцией. Разговора, записанного ещё не закоммиченной транзакцией приёма,
 * она бы там не нашла — и ответила на вопрос, которого «нет».
 *
 * <p><b>Почему свой пул, а не общий {@code @Async}.</b> Считающий ответ ждёт
 * внешнюю систему, и предел здесь нужен свой: пул, общий с задачами, которые
 * ничего не ждут, при недоступной модели забивается ожиданием целиком.
 * Очередь ограничена, а не бесконечна: бесконечная очередь превращает отказ
 * модели в тысячу посетителей, которые ждут ответа второй час. Лучше сказать
 * сразу, что отвечает человек.
 *
 * <p><b>Чего здесь нет.</b> Повторных попыток. Ответ Ведалины не обязателен —
 * штатный запасной путь у разговора уже есть, и это очередь к сотруднику.
 * Повтор означал бы, что посетитель ждёт ещё столько же ради того же
 * неизвестного исхода.
 */
@Component
public class Answering {

    private static final Logger log = LoggerFactory.getLogger(Answering.class);

    // Два постоянных потока, до восьми под нагрузкой. Считающий ответ почти
    // всё время ждёт внешнюю систему, а не занимает процессор, — поэтому
    // потоков больше, чем ядер, и это не ошибка.
    private static final int CORE = 2;
    private static final int MAX = 8;

    // Сотня ожидающих: при десяти секундах на ответ это две минуты очереди.
    // Дальше ждать бессмысленно — посетитель уйдёт раньше, чем дождётся,
    // и лучше отдать его человеку сразу.
    private static final int QUEUE = 100;

    private final ChatDesk desk;
    private final AssistantService assistant;
    private final ChatStream stream;

    private final ThreadPoolExecutor pool = new ThreadPoolExecutor(
            CORE, MAX, 60L, TimeUnit.SECONDS, new ArrayBlockingQueue<>(QUEUE), named());

    public Answering(ChatDesk desk, AssistantService assistant, ChatStream stream) {
        this.desk = desk;
        this.assistant = assistant;
        this.stream = stream;
    }

    // Имена потоков нужны в журнале и в дампе: «pool-3-thread-2» не говорит
    // ничего, а разбирать зависший ответ придётся именно по дампу.
    private static ThreadFactory named() {
        var counter = new AtomicInteger();
        return runnable -> {
            var thread = new Thread(runnable, "vedalina-" + counter.incrementAndGet());
            // Демон: незавершённый ответ не должен держать остановку приложения.
            // Посетитель на перезапуске портала получит очередь к человеку,
            // и это лучше, чем портал, который не гасится.
            thread.setDaemon(true);
            return thread;
        };
    }

    /**
     * Вопрос принят — беремся за ответ.
     *
     * <p>Точки в окне посетителя загораются здесь, а не внутри задачи: между
     * приёмом вопроса и свободным потоком может пройти время, и всё это время
     * человек уже ждёт.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onAsked(ChatDesk.Asked asked) {
        stream.startedAnswering(asked.conversationId(), asked.visitorKey());
        try {
            pool.execute(() -> answer(asked));
        } catch (RejectedExecutionException e) {
            // Очередь переполнена. Молчать нельзя: посетитель видит точки
            // и ждёт ответа, которого никто не готовит.
            log.warn("Очередь ответов переполнена, разговор {} уходит человеку",
                    asked.conversationId());
            fail(asked);
        }
    }

    /**
     * Посчитать и записать ответ.
     *
     * <p>Открыт для вызова напрямую — так его прогоняют тесты: в тесте
     * транзакция откатывается, до COMMIT дело не доходит, и слушатель
     * не сработает никогда. Прогонять тем же вызовом важнее, чем спрятать:
     * иначе проверялся бы путь, которым портал не ходит.
     */
    public void answer(ChatDesk.Asked asked) {
        try {
            // Чат на сайте — открытый контур: посетитель, не сотрудник.
            //
            // Куски ответа уходят посетителю по мере готовности. Детерминированный
            // поиск отдаёт один кусок — он ничего не генерирует, и притворяться,
            // что он печатает по словам, значит рисовать работу, которой нет.
            var reply = assistant.ask(asked.question(), LlmEngine.Scope.PUBLIC, "public",
                    chunk -> stream.draft(asked.conversationId(), asked.visitorKey(), chunk));

            desk.answered(asked.conversationId(), reply);

        } catch (RuntimeException e) {
            log.warn("Ответ по разговору {} не сложился: {}",
                    asked.conversationId(), e.toString());
            fail(asked);
        } finally {
            // В finally, а не после успеха: флаг, оставшийся включённым,
            // это вечные точки в окне у человека, которому никто не отвечает.
            stream.finishedAnswering(asked.conversationId());
        }
    }

    private void fail(ChatDesk.Asked asked) {
        try {
            desk.answerFailed(asked.conversationId());
        } catch (RuntimeException e) {
            // Записать не удалось вовсе — разговор останется без ответа,
            // и это худший исход. В журнал он попадает громко: тихо
            // потерянный разговор не заметит никто.
            log.error("Разговор {} остался без ответа и без передачи человеку",
                    asked.conversationId(), e);
        } finally {
            stream.finishedAnswering(asked.conversationId());
        }
    }

    @PreDestroy
    void stop() {
        pool.shutdownNow();
    }
}
