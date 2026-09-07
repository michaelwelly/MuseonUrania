package ru.vedal.portal.notifications;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import ru.vedal.portal.PostgresTestBase;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

// Автоочистка писем по сроку хранения.
//
// Отдельный контекст: свойство vedal.privacy.retention.mail здесь задано,
// а в остальных тестах — нет (см. MailPrivacyTest.retentionSweepDoesNotExist...).
@TestPropertySource(properties = "vedal.privacy.retention.mail=P30D")
class MailRetentionSweepTest extends PostgresTestBase {

    @Autowired
    MailRetentionSweep sweep;

    @Autowired
    OutboundMailRepository mails;

    private UUID mail(String status, Instant createdAt) {
        var mail = new OutboundMail();
        mail.setId(UUID.randomUUID());
        mail.setTemplate("LEAD_CONFIRMATION");
        mail.setToAddress("ivanov@example.ru");
        mail.setSubject("VEDAL: заявка принята");
        mail.setBody("Спасибо.");
        mail.setStatus(status);
        mail.setCreatedAt(createdAt);
        if ("sent".equals(status)) mail.setSentAt(createdAt);
        mails.save(mail);
        return mail.getId();
    }

    @Test
    void erasesMailOlderThanTheConfiguredTerm() {
        var old = mail("sent", Instant.now().minus(40, ChronoUnit.DAYS));

        sweep.sweep();

        var after = mails.findById(old).orElseThrow();
        assertThat(after.getErasedAt()).isNotNull();
        assertThat(after.getErasureBasis()).isEqualTo("истёк срок хранения");
        assertThat(after.getToAddress()).isEqualTo(MailPrivacy.ERASED);
    }

    @Test
    void leavesFreshMailUntouched() {
        var fresh = mail("sent", Instant.now());

        sweep.sweep();

        assertThat(mails.findById(fresh).orElseThrow().getErasedAt()).isNull();
    }

    // Даже старое письмо, которое почему-то всё ещё в очереди, не трогаем:
    // адрес нужен самой попытке отправки.
    @Test
    void leavesQueuedMailUntouchedRegardlessOfAge() {
        var stuck = mail(OutboundMail.QUEUED, Instant.now().minus(40, ChronoUnit.DAYS));

        sweep.sweep();

        var after = mails.findById(stuck).orElseThrow();
        assertThat(after.getErasedAt()).isNull();
        assertThat(after.getToAddress()).isEqualTo("ivanov@example.ru");
    }
}
