package ru.vedal.portal.notifications;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import ru.vedal.portal.common.DomainEventConsumer;
import ru.vedal.portal.common.Outbox;
import ru.vedal.portal.crm.LeadContacts;

import java.util.UUID;

// Потребитель события заявки: ставит в очередь подтверждение клиенту
// и уведомление менеджеру.
@Component
public class LeadNotifier implements DomainEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(LeadNotifier.class);
    private static final String LEAD_EVENT = "vedal.leads.v1";

    private final LeadContacts contacts;
    private final Mailer mailer;
    private final String manager;
    private final String portalUrl;

    public LeadNotifier(LeadContacts contacts, Mailer mailer,
                        @Value("${vedal.notifications.manager:}") String manager,
                        @Value("${vedal.notifications.portal-url}") String portalUrl) {
        this.contacts = contacts;
        this.mailer = mailer;
        this.manager = manager;
        this.portalUrl = portalUrl;
    }

    @Override
    public String name() {
        return "notifications.lead";
    }

    @Override
    public boolean handles(String type) {
        return LEAD_EVENT.equals(type);
    }

    @Override
    public void consume(Outbox event) {
        var leadId = UUID.fromString(event.getAggregateId());

        // Адрес берём из crm по идентификатору, а не из payload события:
        // персональные данные не должны уезжать в топики.
        var contact = contacts.contact(leadId).orElse(null);
        if (contact == null) {
            log.warn("заявка {} не найдена, письма не поставлены в очередь", leadId);
            return;
        }

        var context = new MailTemplate.Context(leadId, contact.form(), contact.productSlug(), portalUrl);
        mailer.queue(MailTemplate.LEAD_CONFIRMATION, contact.email(), context, leadId);

        if (manager.isBlank()) {
            // Адрес не настроен — молча заводить чужую почту нельзя.
            log.warn("vedal.notifications.manager не задан: уведомление по заявке {} не отправлено", leadId);
            return;
        }
        mailer.queue(MailTemplate.LEAD_MANAGER_NOTICE, manager, context, leadId);
    }
}
