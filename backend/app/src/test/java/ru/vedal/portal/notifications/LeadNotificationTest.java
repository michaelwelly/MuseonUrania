package ru.vedal.portal.notifications;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.common.EventConsumedRepository;
import ru.vedal.portal.common.OutboxRelay;
import ru.vedal.portal.common.OutboxRepository;
import ru.vedal.portal.crm.LeadIntake;
import ru.vedal.portal.crm.LeadRepository;

import static org.assertj.core.api.Assertions.assertThat;

class LeadNotificationTest extends PostgresTestBase {

    @Autowired
    LeadIntake intake;

    @Autowired
    OutboxRelay relay;

    @Autowired
    MailDispatch dispatch;

    @Autowired
    OutboundMailRepository mails;

    @Autowired
    LeadRepository leads;

    @Autowired
    OutboxRepository outbox;

    @Autowired
    EventConsumedRepository consumed;

    @Test
    void leadProducesConfirmationAndManagerNotice() {
        clean();
        accept("notify-1");

        relay.drain();

        assertThat(mails.findAll()).hasSize(2);
        assertThat(mails.findAll()).extracting(OutboundMail::getTemplate)
                .containsExactlyInAnyOrder("LEAD_CONFIRMATION", "LEAD_MANAGER_NOTICE");

        var confirmation = mails.findAll().stream()
                .filter(m -> m.getTemplate().equals("LEAD_CONFIRMATION")).findFirst().orElseThrow();
        assertThat(confirmation.getToAddress()).isEqualTo("client@example.ru");
        assertThat(confirmation.getBody()).contains("Спасибо. Специалист VEDAL свяжется с вами.");
    }

    // Из брифа: «клиентская база не живёт в почте». В открытый контур уходит
    // указатель на запись в портале, а не сами данные.
    @Test
    void managerNoticeCarriesNoPersonalData() {
        clean();
        accept("notify-2");

        relay.drain();

        var notice = mails.findAll().stream()
                .filter(m -> m.getTemplate().equals("LEAD_MANAGER_NOTICE")).findFirst().orElseThrow();

        assertThat(notice.getBody())
                .doesNotContain("Пётр Смирнов")
                .doesNotContain("client@example.ru")
                .doesNotContain("555-33-22");
        assertThat(notice.getBody()).contains("/admin/leads");
    }

    @Test
    void queuedMailIsSentOnce() {
        clean();
        accept("notify-3");
        relay.drain();

        assertThat(dispatch.drain()).isEqualTo(2);
        assertThat(mails.findAll()).allSatisfy(m -> {
            assertThat(m.getStatus()).isEqualTo("sent");
            assertThat(m.getSentAt()).isNotNull();
            assertThat(m.getAttempts()).isEqualTo(1);
        });

        assertThat(dispatch.drain()).as("отправленное не уходит второй раз").isZero();
    }

    @Test
    void repeatedDeliveryOfSameEventDoesNotDoubleTheMail() {
        clean();
        accept("notify-4");

        relay.drain();
        // Возвращаем событие в неотправленные — так выглядит повторная доставка.
        outbox.findAll().forEach(e -> {
            e.setPublishedAt(null);
            outbox.save(e);
        });
        relay.drain();

        assertThat(mails.findAll()).as("потребитель идемпотентен").hasSize(2);
    }

    private void accept(String key) {
        intake.accept(new LeadIntake.Draft("service", "Пётр Смирнов", null,
                "+7 343 555-33-22", "client@example.ru", "vedal-a-2000", null,
                "Нужен сервисный выезд по инкубатору.", "site", "ru", null), key);
    }

    private void clean() {
        mails.deleteAll();
        consumed.deleteAll();
        outbox.deleteAll();
        leads.deleteAll();
    }
}
