package ru.vedal.portal.notifications;

import com.icegreen.greenmail.configuration.GreenMailConfiguration;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.util.ServerSetup;
import jakarta.mail.Address;
import jakarta.mail.SendFailedException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Настоящий SMTP-сервер в процессе теста, а не подменённый порт MailSender.
// Подмена проверила бы, что мы вызвали метод; ломается же обычно то, что видно
// только на протоколе: кодировка русской темы, обратный адрес, авторизация.
class SmtpMailSenderTest {

    private static final String FROM = "portal@vedal-med.ru";
    private static final String PASSWORD = "smtp-test-secret";

    // Порт 0 — сервер занимает свободный и сообщает какой. Фиксированный номер
    // на машине разработчика рано или поздно оказывается занят чужим стеком,
    // и тест падает по причине, не имеющей отношения к почте.
    @RegisterExtension
    static final GreenMailExtension SMTP = new GreenMailExtension(
            new ServerSetup(0, "127.0.0.1", ServerSetup.PROTOCOL_SMTP))
            .withConfiguration(GreenMailConfiguration.aConfig().withUser(FROM, PASSWORD));

    @Test
    void mailReachesTheServerWithRussianSubjectAndBody() throws Exception {
        var sender = new SmtpMailSender(transport(), FROM);

        sender.send("client@example.ru", "VEDAL: заявка принята",
                "Спасибо. Специалист VEDAL свяжется с вами.");

        var received = SMTP.getReceivedMessages();
        assertThat(received).hasSize(1);
        var message = received[0];
        // Тема едет в заголовке и обязана быть закодирована: без кодировки
        // получатель увидит «=?UTF-8?B?...» или мусор.
        assertThat(message.getSubject()).isEqualTo("VEDAL: заявка принята");
        assertThat(message.getAllRecipients()[0]).hasToString("client@example.ru");
        assertThat(message.getFrom()[0]).hasToString(FROM);
        assertThat(message.getContent().toString())
                .contains("Спасибо. Специалист VEDAL свяжется с вами.");
    }

    // Адрес получателя приходит из формы на сайте. Перевод строки в нём —
    // это попытка дописать в наше письмо свои заголовки.
    @Test
    void newlineInRecipientIsRejectedAndNothingIsSent() {
        var sender = new SmtpMailSender(transport(), FROM);

        assertThatThrownBy(() -> sender.send(
                "client@example.ru\r\nBcc: leak@example.org", "VEDAL: заявка принята", "текст"))
                .isInstanceOf(MailPermanentFailure.class)
                .hasMessageContaining("управляющий символ");

        assertThat(SMTP.getReceivedMessages()).isEmpty();
    }

    @Test
    void newlineInSubjectIsRejectedAndNothingIsSent() {
        var sender = new SmtpMailSender(transport(), FROM);

        assertThatThrownBy(() -> sender.send(
                "client@example.ru", "заявка\r\nBcc: leak@example.org", "текст"))
                .isInstanceOf(MailPermanentFailure.class)
                .hasMessageContaining("управляющий символ");

        assertThat(SMTP.getReceivedMessages()).isEmpty();
    }

    // Сервер недоступен — это временный отказ: письмо ждёт следующей попытки,
    // а не уходит в разбор руками.
    @Test
    void unreachableServerIsTransient() {
        var dead = new JavaMailSenderImpl();
        dead.setHost("127.0.0.1");
        // Порт 1 занять нечем: соединение отвергается сразу, тест не ждёт таймаут.
        dead.setPort(1);
        dead.getJavaMailProperties().put("mail.smtp.connectiontimeout", "2000");
        var sender = new SmtpMailSender(dead, FROM);

        assertThatThrownBy(() -> sender.send("client@example.ru", "тема", "текст"))
                .isInstanceOf(MailTransientFailure.class);
    }

    // Сервер отверг сам адрес (нет такого ящика) — повторять нечего, письмо
    // сразу в разбор руками. Отказ собирается вручную: заставить настоящий
    // сервер ответить 550 на нужном шаге нечем, а разница между этой веткой
    // и предыдущей — это разница между «дойдёт через час» и «не дойдёт никогда».
    @Test
    void addressRejectedByServerIsPermanent() {
        var sender = new SmtpMailSender(rejectingTransport(), FROM);

        assertThatThrownBy(() -> sender.send("no-such-box@example.ru", "тема", "текст"))
                .isInstanceOf(MailPermanentFailure.class)
                .hasMessageContaining("адрес отвергнут");
    }

    private static JavaMailSenderImpl transport() {
        var impl = new JavaMailSenderImpl();
        impl.setHost("127.0.0.1");
        impl.setPort(SMTP.getSmtp().getPort());
        impl.setUsername(FROM);
        impl.setPassword(PASSWORD);
        impl.getJavaMailProperties().put("mail.smtp.auth", "true");
        return impl;
    }

    private static JavaMailSenderImpl rejectingTransport() {
        return new JavaMailSenderImpl() {
            @Override
            public void send(MimeMessage... messages) {
                Address[] invalid;
                try {
                    invalid = new Address[]{new InternetAddress("no-such-box@example.ru")};
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
                var rejected = new SendFailedException("550 5.1.1 no such user",
                        new Exception("550"), new Address[0], new Address[0], invalid);
                throw new MailSendException(Map.of(messages[0], rejected));
            }
        };
    }
}
