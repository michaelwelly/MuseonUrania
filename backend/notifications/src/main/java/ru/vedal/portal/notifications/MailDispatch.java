package ru.vedal.portal.notifications;

import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;

// Отправка из очереди. Расписание — в отдельном бине MailSchedule: вызов
// @Transactional-метода у себя же идёт мимо прокси и статус письма не сохранится.
@Component
public class MailDispatch {

    private static final Logger log = LoggerFactory.getLogger(MailDispatch.class);
    private static final int BATCH = 50;

    static final String SENT = "sent";
    static final String FAILED = "failed";

    private final OutboundMailRepository mails;
    private final MailSender sender;
    private final int maxAttempts;
    private final AtomicLong queued = new AtomicLong();
    private final AtomicLong failed = new AtomicLong();

    public MailDispatch(OutboundMailRepository mails, MailSender sender,
                        @Value("${vedal.notifications.max-attempts:5}") int maxAttempts,
                        MeterRegistry meters) {
        this.mails = mails;
        this.sender = sender;
        this.maxAttempts = maxAttempts;
        meters.gauge("vedal.mail.queued", queued);
        meters.gauge("vedal.mail.failed", failed);
    }

    @Transactional
    public int drain() {
        var batch = mails.findByStatusOrderByCreatedAtAsc(Mailer.QUEUED, Limit.of(BATCH));
        for (var mail : batch) {
            mail.setAttempts(mail.getAttempts() + 1);
            try {
                sender.send(mail.getToAddress(), mail.getSubject(), mail.getBody());
                mail.setStatus(SENT);
                mail.setSentAt(Instant.now());
                mail.setLastError(null);
            } catch (RuntimeException e) {
                mail.setLastError(e.getClass().getSimpleName() + ": " + e.getMessage());
                // После исчерпания попыток письмо уходит в разбор руками,
                // а не крутится в очереди вечно и не тормозит остальные.
                if (mail.getAttempts() >= maxAttempts) {
                    mail.setStatus(FAILED);
                    log.warn("письмо {} не ушло после {} попыток: {}",
                            mail.getId(), mail.getAttempts(), mail.getLastError());
                }
            }
            mails.save(mail);
        }
        return batch.size();
    }

    @Transactional(readOnly = true)
    public void measure() {
        queued.set(mails.countByStatus(Mailer.QUEUED));
        failed.set(mails.countByStatus(FAILED));
        if (failed.get() > 0) {
            log.warn("писем в разборе: {}", failed.get());
        }
    }
}
