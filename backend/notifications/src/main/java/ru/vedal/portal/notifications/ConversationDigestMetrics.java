package ru.vedal.portal.notifications;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

/** Durable delivery state, including retries, survives application restarts. */
@Component
public class ConversationDigestMetrics {
    public ConversationDigestMetrics(OutboundMailRepository mails, MeterRegistry meters) {
        for (var status : new String[]{"queued", "sent", "failed"}) {
            Gauge.builder("vedal.mail.conversation.digest", mails,
                    repository -> repository.countByTemplateAndStatus("CONVERSATION_DIGEST", status))
                    .tag("status", status).description("Daily conversation reports by delivery status")
                    .register(meters);
        }
    }
}
