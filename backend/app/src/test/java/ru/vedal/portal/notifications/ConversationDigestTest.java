package ru.vedal.portal.notifications;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.ConversationDigestSchedule;
import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.*;

class ConversationDigestTest extends PostgresTestBase {
    @Autowired ConversationDigest digest;
    @Autowired JdbcTemplate jdbc;
    @Autowired OutboundMailRepository mails;
    @Autowired io.micrometer.core.instrument.MeterRegistry meters;
    @Autowired jakarta.persistence.EntityManager entities;

    @Test void oneReportPerMoscowDateUsesQueueAndContainsNoVisitorText() throws Exception {
        var date = LocalDate.of(2035, 1, 10);
        jdbc.update("insert into conversation(id, visitor_key, language, status, board_summary, stage, importance) values (?, ?, 'ru', 'open', 'Private visitor text', 'selection', 'urgent')", UUID.randomUUID(), UUID.randomUUID().toString());
        assertThat(digest.queue(date)).isTrue();
        assertThat(digest.queue(date)).isFalse();
        var id = jdbc.queryForObject("select id from outbound_mail where dedup_key = ?", UUID.class, "conversation-digest:" + date);
        var mail = mails.findById(id).orElseThrow();
        assertThat(mail.getToAddress()).isEqualTo("sales@vedal-med.ru");
        assertThat(mail.getBody()).contains("Подбор: 1", "Срочные открытые: 1", "/admin/chats/").doesNotContain("Private visitor text");
        assertThat(mail.getStatus()).isEqualTo("queued");
        entities.flush();
        assertThat(jdbc.queryForObject("select count(*) from audit_entry where action = 'chat.digest.queued' and subject_id = ?", Long.class, date.toString())).isEqualTo(1);
        var schedule = ConversationDigestSchedule.class.getMethod("run").getAnnotation(Scheduled.class);
        assertThat(schedule.cron()).isEqualTo("0 0 9 * * *");
        assertThat(schedule.zone()).isEqualTo("Europe/Moscow");
        assertThat(meters.get("vedal.mail.conversation.digest").tag("status", "queued").gauge().value()).isGreaterThanOrEqualTo(1);
    }

    @Test
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void concurrentSchedulersCreateOneCommittedQueueEntry() throws Exception {
        var date = LocalDate.of(2097, 8, 19);
        String key = "conversation-digest:" + date;
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var start = new java.util.concurrent.CountDownLatch(1);
            java.util.concurrent.Callable<Boolean> call = () -> { start.await(); return digest.queue(date); };
            var first = executor.submit(call);
            var second = executor.submit(call);
            start.countDown();
            assertThat(java.util.List.of(first.get(30, java.util.concurrent.TimeUnit.SECONDS),
                    second.get(30, java.util.concurrent.TimeUnit.SECONDS))).containsExactlyInAnyOrder(true, false);
            assertThat(jdbc.queryForObject("select count(*) from outbound_mail where dedup_key = ?", Long.class, key)).isEqualTo(1);
        } finally {
            jdbc.update("delete from outbound_mail where dedup_key = ?", key);
        }
    }

    @Test void transientDeliveryRetriesSameQueueRowAndSentReportIsNotResent() {
        var date = LocalDate.of(2035, 1, 11);
        digest.queue(date);
        var id = jdbc.queryForObject("select id from outbound_mail where dedup_key = ?", UUID.class, "conversation-digest:" + date);
        var calls = new AtomicInteger();
        var attempt = new MailAttempt(mails, (to, subject, body) -> {
            if (calls.getAndIncrement() == 0) throw new MailTransientFailure("Temporary SMTP failure", null);
        }, 5);
        attempt.run(id);
        assertThat(mails.findById(id).orElseThrow().getStatus()).isEqualTo("queued");
        attempt.run(id);
        assertThat(mails.findById(id).orElseThrow().getStatus()).isEqualTo("sent");
        attempt.run(id);
        assertThat(calls.get()).isEqualTo(2);
        assertThat(digest.queue(date)).isFalse();
    }
}
