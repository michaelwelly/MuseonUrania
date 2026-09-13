package ru.vedal.portal.notifications;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.common.CorrelationId;

import java.util.UUID;

// Единственный способ поставить письмо в очередь. Принимает шаблон и данные,
// а не готовый текст: свободный текст наружу через этот модуль не уходит.
@Service
public class Mailer {

    private final OutboundMailRepository mails;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    /** Fixed aggregate report. No visitor text or contact data leaves the portal. */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean queueConversationDigest(java.time.LocalDate date, String portalUrl,
                                          java.util.Map<String, Long> stages, long urgent, long unassigned) {
        String body = "Разговоры VEDAL на " + date + " (09:00 МСК)\n\n"
                + "Новые: " + stages.getOrDefault("new", 0L) + "\n"
                + "Уточнение: " + stages.getOrDefault("clarification", 0L) + "\n"
                + "Подбор: " + stages.getOrDefault("selection", 0L) + "\n"
                + "Готовы к КП: " + stages.getOrDefault("ready_for_quote", 0L) + "\n"
                + "Переданы человеку: " + stages.getOrDefault("handed_to_human", 0L) + "\n"
                + "Закрыты за последние сутки: " + stages.getOrDefault("closed", 0L) + "\n"
                + "Срочные открытые: " + urgent + "\nБез ответственного: " + unassigned + "\n\n"
                + "Резюме и следующие шаги: " + portalUrl.replaceAll("/+$", "") + "/admin/chats/\n";
        return jdbc.update("""
                insert into outbound_mail(id, template, to_address, subject, body, status, dedup_key)
                values (?, 'CONVERSATION_DIGEST', 'sales@vedal-med.ru', ?, ?, 'queued', ?)
                on conflict (dedup_key) do nothing
                """, UUID.randomUUID(), "VEDAL — сводка разговоров за " + date, body,
                "conversation-digest:" + date) == 1;
    }


    public Mailer(OutboundMailRepository mails, org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.mails = mails;
        this.jdbc = jdbc;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public UUID queue(MailTemplate template, String to, MailTemplate.Context context, UUID leadId) {
        var mail = new OutboundMail();
        mail.setId(UUID.randomUUID());
        mail.setTemplate(template.name());
        mail.setToAddress(to);
        mail.setSubject(template.subject());
        mail.setBody(template.body(context));
        mail.setLeadId(leadId);
        mail.setCorrelationId(CorrelationId.current());
        mail.setStatus(OutboundMail.QUEUED);
        mails.save(mail);
        return mail.getId();
    }
}
