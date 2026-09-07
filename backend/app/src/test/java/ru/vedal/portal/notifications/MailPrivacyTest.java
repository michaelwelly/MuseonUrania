package ru.vedal.portal.notifications;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.PostgresTestBase;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Уничтожение персональных данных писем по обращению субъекта и по сроку.
class MailPrivacyTest extends PostgresTestBase {

    @Autowired
    MailPrivacy privacy;

    @Autowired
    OutboundMailRepository mails;

    @Autowired
    org.springframework.context.ApplicationContext context;

    private UUID sent(String to, UUID leadId) {
        var mail = new OutboundMail();
        mail.setId(UUID.randomUUID());
        mail.setTemplate("LEAD_CONFIRMATION");
        mail.setToAddress(to);
        mail.setSubject("VEDAL: заявка принята");
        mail.setBody("Спасибо. Специалист VEDAL свяжется с вами.");
        mail.setLeadId(leadId);
        mail.setStatus("sent");
        mail.setSentAt(Instant.now());
        mails.save(mail);
        return mail.getId();
    }

    @Test
    void erasesAddressSubjectAndBody() {
        var id = sent("ivanov@example.ru", null);

        assertThat(privacy.erase(id, "обращение субъекта", "anna")).isTrue();

        var after = mails.findById(id).orElseThrow();
        assertThat(after.getToAddress()).isEqualTo(MailPrivacy.ERASED);
        assertThat(after.getSubject()).isEqualTo(MailPrivacy.ERASED);
        assertThat(after.getBody()).isEqualTo(MailPrivacy.ERASED);
    }

    // template, статус, число попыток и корреляция нужны разбору доставки
    // так же, как заявке — разбору воронки, и после обезличивания остаются.
    @Test
    void keepsWhatDeliveryReviewNeeds() {
        var id = sent("ivanov@example.ru", null);
        var before = mails.findById(id).orElseThrow();
        before.setAttempts(2);
        before.setCorrelationId("corr-1");
        mails.save(before);

        privacy.erase(id, "обращение субъекта", "anna");

        var after = mails.findById(id).orElseThrow();
        assertThat(after.getTemplate()).isEqualTo("LEAD_CONFIRMATION");
        assertThat(after.getStatus()).isEqualTo("sent");
        assertThat(after.getAttempts()).isEqualTo(2);
        assertThat(after.getCorrelationId()).isEqualTo("corr-1");
    }

    @Test
    void recordsWhenAndOnWhatGrounds() {
        var id = sent("ivanov@example.ru", null);

        privacy.erase(id, "обращение субъекта", "anna");

        var after = mails.findById(id).orElseThrow();
        assertThat(after.getErasedAt()).isNotNull();
        assertThat(after.getErasureBasis()).isEqualTo("обращение субъекта");
    }

    @Test
    void secondRequestChangesNothingAndIsNotAnError() {
        var id = sent("ivanov@example.ru", null);
        privacy.erase(id, "обращение субъекта", "anna");

        assertThat(privacy.erase(id, "обращение субъекта", "anna")).isFalse();
    }

    // Письмо, которое ещё в очереди, не трогаем: адрес получателя нужен самой
    // попытке отправки, а «удалено» вместо него хоронит письмо, которое
    // вот-вот должно уйти.
    @Test
    void leavesQueuedMailAlone() {
        var mail = new OutboundMail();
        mail.setId(UUID.randomUUID());
        mail.setTemplate("LEAD_CONFIRMATION");
        mail.setToAddress("ivanov@example.ru");
        mail.setSubject("VEDAL: заявка принята");
        mail.setBody("Спасибо.");
        mail.setStatus(OutboundMail.QUEUED);
        mails.save(mail);

        assertThat(privacy.erase(mail.getId(), "обращение субъекта", "anna")).isFalse();

        var after = mails.findById(mail.getId()).orElseThrow();
        assertThat(after.getToAddress()).isEqualTo("ivanov@example.ru");
        assertThat(after.getErasedAt()).isNull();
    }

    // Обращение человек подаёт одно, а данные лежат в нескольких местах:
    // в заявке, в переписке и в письме-подтверждении.
    @Test
    void eraseByLeadReachesEveryMailSentForIt() {
        var leadId = UUID.randomUUID();
        var confirmation = sent("ivanov@example.ru", leadId);
        var unrelated = sent("other@example.ru", null);

        assertThat(privacy.eraseByLead(leadId, "обращение субъекта", "anna")).isEqualTo(1);

        assertThat(mails.findById(confirmation).orElseThrow().getErasedAt()).isNotNull();
        assertThat(mails.findById(unrelated).orElseThrow().getErasedAt()).isNull();
    }

    @Test
    void unknownMailIsRefusedRatherThanSilentlyIgnored() {
        assertThatThrownBy(() -> privacy.erase(UUID.randomUUID(), "обращение субъекта", "anna"))
                .hasMessageContaining("не найдено");
    }

    // Срок хранения писем не подтверждён заказчиком (docs/PROJECT.md, 12.2),
    // а обезличивание необратимо. Механизм есть, а бина нет: без свойства
    // vedal.privacy.retention.mail класс не создаётся вовсе.
    @Test
    void retentionSweepDoesNotExistUntilTheTermIsConfirmed() {
        assertThat(context.getBeanNamesForType(MailRetentionSweep.class))
                .as("Автоочистка писем включается только явно заданным сроком хранения")
                .isEmpty();
    }
}
