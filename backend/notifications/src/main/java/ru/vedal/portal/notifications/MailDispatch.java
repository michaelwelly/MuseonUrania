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
    private final MailSender sender;
    private final AtomicLong queued = new AtomicLong();
    private final AtomicLong failed = new AtomicLong();

    public MailDispatch(OutboundMailRepository mails, MailAttempt attempt,
                        MailSender sender, MeterRegistry meters) {
        this.mails = mails;
        this.attempt = attempt;
        this.sender = sender;
        meters.gauge("vedal.mail.queued", queued);
        meters.gauge("vedal.mail.failed", failed);
    }

    // Возвращает, сколько писем взято в работу за этот заход, — не сколько
    // ушло. Часть могла отказать и остаться в очереди до следующей попытки.
    public int drain() {
        // Почты нет — очередь не трогаем. Отправить нечем, а любое действие
        // здесь было бы враньём: пометка «отправлено» скрывает от человека
        // заявку, которую он ждёт письмом, а отказ израсходует попытки
        // и похоронит письмо из-за незаданной настройки.
        //
        // Письма ждут. Когда SMTP настроят, накопленное уедет тем же заходом,
        // и заказчик получит и те заявки, что пришли раньше.
        if (!sender.configured()) {
            return 0;
        }

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
        // Копящаяся очередь при ненастроенной почте — не поломка, а состояние,
        // о котором надо говорить вслух: снаружи оно выглядит как «заявки
        // приходят, а писем нет», и списывают это обычно на почтовый ящик.
        if (!sender.configured() && queued.get() > 0) {
            log.warn("писем ждёт отправки: {}. SMTP не настроен — задайте"
                    + " SPRING_MAIL_HOST, SPRING_MAIL_USERNAME и SPRING_MAIL_PASSWORD,"
                    + " и накопленное уйдёт", queued.get());
        }
    }
}
