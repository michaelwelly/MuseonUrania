package ru.vedal.portal;

import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import ru.vedal.portal.notifications.ConversationDigest;
import java.time.*;

@Component
@ConditionalOnProperty(name = "vedal.notifications.conversation-digest-enabled", havingValue = "true")
public class ConversationDigestSchedule {
    private final ConversationDigest digest;
    public ConversationDigestSchedule(ConversationDigest digest) { this.digest = digest; }
    @Scheduled(cron = "0 0 9 * * *", zone = "Europe/Moscow")
    public void run() { digest.queue(LocalDate.now(ZoneId.of("Europe/Moscow"))); }
}
