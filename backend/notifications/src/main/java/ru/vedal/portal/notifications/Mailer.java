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

    public Mailer(OutboundMailRepository mails) {
        this.mails = mails;
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
