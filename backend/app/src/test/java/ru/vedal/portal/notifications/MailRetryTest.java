package ru.vedal.portal.notifications;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.PostgresTestBase;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;

// Поведение очереди при отказах транспорта. Пока отправителем была запись
// в лог, проверять здесь было нечего: лог не отказывает. С настоящим SMTP
// именно эта ветка решает, дойдёт письмо или нет.
class MailRetryTest extends PostgresTestBase {

    @Autowired
    MailDispatch dispatch;

    @Autowired
    OutboundMailRepository mails;

    @Autowired
    ScriptedSender sender;

    @BeforeEach
    void resetTransport() {
        sender.reset();
    }

    // Недоступный сервер не должен хоронить письмо: оно остаётся в очереди
    // и ждёт. До выдержки пять попыток сгорали за двадцать пять секунд.
    @Test
    void transientFailureKeepsMailInQueueAndDefersIt() {
        sender.failure = () -> new MailTransientFailure("сервер недоступен", null);
        var id = queued("client@example.ru");
        var before = Instant.now();

        assertThat(dispatch.drain()).isEqualTo(1);

        var mail = mails.findById(id).orElseThrow();
        assertThat(mail.getStatus()).isEqualTo("queued");
        assertThat(mail.getAttempts()).isEqualTo(1);
        assertThat(mail.getLastError()).contains("сервер недоступен");
        assertThat(mail.getNextAttemptAt())
                .as("первая выдержка — минута")
                .isAfter(before.plus(Duration.ofSeconds(50)))
                .isBefore(before.plus(Duration.ofSeconds(70)));
    }

    @Test
    void deferredMailIsNotPickedUpBeforeItsTime() {
        sender.failure = () -> new MailTransientFailure("сервер недоступен", null);
        queued("client@example.ru");

        dispatch.drain();

        assertThat(dispatch.drain()).as("минута ещё не прошла").isZero();
    }

    @Test
    void deferredMailGoesOutWhenItsTimeComes() {
        sender.failure = () -> new MailTransientFailure("сервер недоступен", null);
        var id = queued("client@example.ru");
        dispatch.drain();

        // Сервер починили, время следующей попытки наступило.
        var mail = mails.findById(id).orElseThrow();
        mail.setNextAttemptAt(Instant.now().minusSeconds(1));
        mails.save(mail);
        sender.failure = null;

        assertThat(dispatch.drain()).isEqualTo(1);

        var sent = mails.findById(id).orElseThrow();
        assertThat(sent.getStatus()).isEqualTo("sent");
        assertThat(sent.getSentAt()).isNotNull();
        assertThat(sent.getAttempts()).isEqualTo(2);
        assertThat(sent.getLastError()).as("причина прошлого отказа снята").isNull();
        assertThat(sender.sent).containsExactly("client@example.ru");
    }

    // Опечатка в адресе за шесть часов не рассосётся: такое письмо идёт
    // в разбор руками сразу, а не занимает очередь пятью попытками.
    @Test
    void permanentFailureGoesStraightToManualReview() {
        sender.failure = () -> new MailPermanentFailure("адрес отвергнут сервером");
        var id = queued("no-such-box@example.ru");

        dispatch.drain();

        var mail = mails.findById(id).orElseThrow();
        assertThat(mail.getStatus()).isEqualTo("failed");
        assertThat(mail.getAttempts()).as("одна попытка, а не пять").isEqualTo(1);
        assertThat(mail.getLastError()).contains("адрес отвергнут сервером");
    }

    @Test
    void mailEndsInManualReviewAfterAllAttempts() {
        sender.failure = () -> new MailTransientFailure("сервер недоступен", null);
        var id = queued("client@example.ru");

        // Пять заходов подряд: между ними отматываем время следующей попытки,
        // иначе тест ждал бы семь часов.
        for (int i = 0; i < 5; i++) {
            dispatch.drain();
            var mail = mails.findById(id).orElseThrow();
            mail.setNextAttemptAt(Instant.now().minusSeconds(1));
            mails.save(mail);
        }

        var mail = mails.findById(id).orElseThrow();
        assertThat(mail.getStatus()).isEqualTo("failed");
        assertThat(mail.getAttempts()).isEqualTo(5);
        assertThat(dispatch.drain()).as("из очереди больше не берётся").isZero();
    }

    // Исход каждого письма записывается сам по себе. Раньше на весь заход была
    // одна транзакция: откат в середине терял статусы уже отправленных писем,
    // и следующий заход отправлял их повторно — дубль клиенту.
    //
    // Внешней транзакции у теста нет намеренно: именно она в остальных тестах
    // склеивает всё в одну, и проверить независимость исходов внутри неё
    // невозможно.
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void eachMailGetsItsOwnOutcome() {
        try {
            var first = queued("first@example.ru");
            var broken = queued("no-such-box@example.ru");
            var third = queued("third@example.ru");
            sender.failure = () -> new MailTransientFailure("сервер недоступен", null);
            sender.failFor = "no-such-box@example.ru";

            dispatch.drain();

            assertThat(mails.findById(first).orElseThrow().getStatus()).isEqualTo("sent");
            assertThat(mails.findById(third).orElseThrow().getStatus()).isEqualTo("sent");
            assertThat(mails.findById(broken).orElseThrow().getStatus()).isEqualTo("queued");
            assertThat(sender.sent).containsExactlyInAnyOrder(
                    "first@example.ru", "third@example.ru");
        } finally {
            mails.deleteAll();
        }
    }

    private UUID queued(String to) {
        var mail = new OutboundMail();
        mail.setId(UUID.randomUUID());
        mail.setTemplate("TEST");
        mail.setToAddress(to);
        mail.setSubject("VEDAL: заявка принята");
        mail.setBody("Спасибо. Специалист VEDAL свяжется с вами.");
        mail.setStatus(OutboundMail.QUEUED);
        mails.save(mail);
        return mail.getId();
    }

    @TestConfiguration
    static class Transport {

        // @Primary, а не подмена бина: в MailSenderConfig отправитель выбирается
        // по наличию JavaMailSender, и спорить с этим выбором в тесте не нужно —
        // достаточно, чтобы в MailAttempt приехал наш.
        @Bean
        @Primary
        ScriptedSender scriptedSender() {
            return new ScriptedSender();
        }
    }

    // Управляемый транспорт: отказывает тем, чем скажут, и запоминает,
    // что через него прошло.
    static class ScriptedSender implements MailSender {

        volatile Supplier<RuntimeException> failure;
        // Адрес, на котором отказывать. null — отказывать на всех.
        volatile String failFor;
        final List<String> sent = new CopyOnWriteArrayList<>();

        @Override
        public void send(String to, String subject, String body) {
            var f = failure;
            if (f != null && (failFor == null || failFor.equals(to))) {
                throw f.get();
            }
            sent.add(to);
        }

        void reset() {
            failure = null;
            failFor = null;
            sent.clear();
        }
    }
}
