package ru.vedal.portal.notifications;

import com.icegreen.greenmail.configuration.GreenMailConfiguration;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.util.ServerSetup;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.common.EventConsumedRepository;
import ru.vedal.portal.common.OutboxRelay;
import ru.vedal.portal.common.OutboxRepository;
import ru.vedal.portal.crm.LeadIntake;
import ru.vedal.portal.crm.LeadRepository;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// Сквозная проверка всего пути: заявка → outbox → очередь writeInboundMail →
// drain() с настоящим SMTP-транспортом → письмо на тестовом сервере.
//
// Остальные тесты проверяют куски по отдельности: SmtpMailSenderTest — сам
// транспорт в изоляции, LeadNotificationTest — очередь с отправителем-заглушкой,
// MailRetryTest — поведение при отказах. Ни один не отвечает на вопрос
// «а точно ли дойдёт, когда заказчик заведёт ящик и впишет три переменные» —
// для него нужен весь путь целиком, с настоящим SMTP на другом конце.
class LeadNotificationSmtpDeliveryTest extends PostgresTestBase {

    private static final String FROM = "portal@vedal-med.ru";
    private static final String PASSWORD = "smtp-test-secret";

    // withPerMethodLifecycle(false) — сервер стартует в beforeAll, а не
    // в beforeEach. Это важно: бин MailSender ниже собирается вместе
    // с контекстом Spring, а тот поднимается до вызова beforeEach у обычных
    // (per-method) расширений JUnit. С поднятием по умолчанию бин ссылался бы
    // на порт ещё не запущенного сервера.
    @RegisterExtension
    static final GreenMailExtension SMTP = new GreenMailExtension(
            new ServerSetup(0, "127.0.0.1", ServerSetup.PROTOCOL_SMTP))
            .withPerMethodLifecycle(false)
            .withConfiguration(GreenMailConfiguration.aConfig().withUser(FROM, PASSWORD));

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
    void confirmationReachesRealSmtpServerAndNamesTheCase() throws Exception {
        clean();
        accept("smtp-e2e-1");

        relay.drain();
        assertThat(dispatch.drain()).as("оба письма — клиенту и менеджеру").isEqualTo(2);

        // Обе записи в очереди отмечены доставленными — портал считает
        // письмо ушедшим, только когда оно действительно принято сервером.
        assertThat(mails.findAll()).allSatisfy(m -> {
            assertThat(m.getStatus()).isEqualTo("sent");
            assertThat(m.getSentAt()).isNotNull();
        });

        var confirmation = mails.findAll().stream()
                .filter(m -> m.getTemplate().equals("LEAD_CONFIRMATION"))
                .findFirst().orElseThrow();

        var received = SMTP.getReceivedMessages();
        assertThat(received).hasSize(2);
        var bodies = bodies(received);

        // Письмо действительно легло на сервер и содержит тот же номер
        // обращения, что и запись в очереди, — а не технический UUID заявки,
        // который человек не сможет прочитать по телефону менеджеру.
        assertThat(bodies).anySatisfy(body -> assertThat(body)
                .isEqualTo(confirmation.getBody())
                .contains("Номер обращения:")
                .doesNotContain(confirmation.getLeadId().toString()));
    }

    private static List<String> bodies(jakarta.mail.internet.MimeMessage[] messages) throws Exception {
        var result = new java.util.ArrayList<String>();
        for (var message : messages) {
            result.add(message.getContent().toString());
        }
        return result;
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

    @TestConfiguration
    static class Transport {

        // Настоящий SmtpMailSender поверх настоящего SMTP-сервера в процессе
        // теста — а не заглушка. Именно транспорт здесь и проверяется:
        // MailSenderConfig (выбор бина по spring.mail.host) уже покрыт
        // MailSenderChoiceTest и MailSenderBootTest отдельно.
        @Bean
        @Primary
        MailSender realSmtpSender() {
            var transport = new JavaMailSenderImpl();
            transport.setHost("127.0.0.1");
            transport.setPort(SMTP.getSmtp().getPort());
            transport.setUsername(FROM);
            transport.setPassword(PASSWORD);
            transport.getJavaMailProperties().put("mail.smtp.auth", "true");
            return new SmtpMailSender(transport, FROM);
        }
    }
}
