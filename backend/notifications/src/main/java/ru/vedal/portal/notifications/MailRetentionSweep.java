package ru.vedal.portal.notifications;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import ru.vedal.portal.common.OnRetentionTerm;

import java.time.Instant;
import java.time.Period;
import java.time.ZoneOffset;

// Срок хранения исходящих писем: те, что старше него, обезличиваются сами.
//
// ————— свой срок, а не срок заявки —————
//
// Письмо хранится ради разбора доставки (ушло ли, сколько попыток, что
// ответил SMTP), а заявка — ради работы с клиентом. Причины разные,
// и общего свойства с заявками нет: vedal.privacy.retention.mail, а не
// то же самое, что у vedal.privacy.retention.
//
// ————— почему выключено по умолчанию —————
//
// Тот же открытый вопрос 12.2 из docs/PROJECT.md: срок не подтверждён
// заказчиком, а обезличивание необратимо. Без свойства
// vedal.privacy.retention.mail — или с пустым его значением — @OnRetentionTerm
// не создаёт этот класс вовсе — включается одной переменной в тот день,
// когда срок назван:
//
//   VEDAL_PRIVACY_RETENTION_MAIL=P3Y
//
// ————— почему пачками —————
//
// То же рассуждение, что у RetentionSweep в crm.
@Component
@OnRetentionTerm("vedal.privacy.retention.mail")
public class MailRetentionSweep {

    private static final Logger log = LoggerFactory.getLogger(MailRetentionSweep.class);

    // Та же формулировка, что у заявок и разговоров, строкой, а не общим
    // enum — notifications не заводит зависимости на crm ради одного слова
    // (crm он и так знает через LeadContacts, но эта строка — не повод
    // добавлять вторую причину для той же зависимости).
    private static final String RETENTION_BASIS = "истёк срок хранения";

    private final OutboundMailRepository mails;
    private final MailPrivacy privacy;
    private final Period retention;
    private final int batch;

    public MailRetentionSweep(OutboundMailRepository mails, MailPrivacy privacy,
                              @Value("${vedal.privacy.retention.mail}") String retention,
                              @Value("${vedal.privacy.batch.mail:500}") int batch) {
        this.mails = mails;
        this.privacy = privacy;
        // Period, а не Duration: срок называют в годах. Разбор при старте,
        // а не при первом проходе: опечатка должна ронять запуск, а не тихо
        // ждать своего часа.
        this.retention = Period.parse(retention);
        this.batch = batch;

        log.info("Срок хранения персональных данных писем: {}. Обезличивание включено.",
                retention);
    }

    @Scheduled(cron = "${vedal.privacy.sweep-cron.mail:0 40 3 * * *}")
    public void sweep() {
        var cutoff = Instant.now().atZone(ZoneOffset.UTC).minus(retention).toInstant();

        var expired = mails.findByCreatedAtBeforeAndErasedAtIsNullAndStatusNot(
                cutoff, OutboundMail.QUEUED, PageRequest.of(0, batch));
        if (expired.isEmpty()) return;

        for (var mail : expired) {
            privacy.erase(mail.getId(), RETENTION_BASIS, "система");
        }

        log.info("Обезличено писем по сроку хранения: {} (старше {})", expired.size(), cutoff);
    }
}
