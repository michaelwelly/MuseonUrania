package ru.vedal.portal.notifications;

import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;

// Обход очереди. Расписание — в отдельном бине MailSchedule, сама попытка —
// в отдельном бине MailAttempt: у каждого письма своя транзакция, и держать
// её здесь нельзя.
//
// Сам drain() не транзакционный намеренно. Обёрнутый в транзакцию, он снова
// сделал бы её общей на весь батч — ровно то, от чего уходили.
@Component
public class MailDispatch {

    private static final Logger log = LoggerFactory.getLogger(MailDispatch.class);

    // Сколько писем берём за один заход. Не «все»: заход должен заканчиваться
    // за обозримое время, иначе накопившаяся после долгого сбоя очередь
    // занимает поток планировщика на часы, а метрики всё это время не
    // обновляются.
    private static final int BATCH = 50;

    private final OutboundMailRepository mails;
    private final MailAttempt attempt;
    private final AtomicLong queued = new AtomicLong();
    private final AtomicLong failed = new AtomicLong();

    public MailDispatch(OutboundMailRepository mails, MailAttempt attempt, MeterRegistry meters) {
        this.mails = mails;
        this.attempt = attempt;
        meters.gauge("vedal.mail.queued", queued);
        meters.gauge("vedal.mail.failed", failed);
    }

    // Возвращает, сколько писем взято в работу за этот заход, — не сколько
    // ушло. Часть могла отказать и остаться в очереди до следующей попытки.
    public int drain() {
        var due = mails.findDue(OutboundMail.QUEUED, Instant.now(), Limit.of(BATCH));
        for (var id : due) {
            attempt.run(id);
        }
        return due.size();
    }

    @Transactional(readOnly = true)
    public void measure() {
        queued.set(mails.countByStatus(OutboundMail.QUEUED));
        failed.set(mails.countByStatus(OutboundMail.FAILED));
        if (failed.get() > 0) {
            log.warn("писем в разборе: {}", failed.get());
        }
    }
}
