package ru.vedal.portal.notifications;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import ru.vedal.portal.audit.AuditLog;
import java.time.*;
import java.util.*;

@Service
public class ConversationDigest {
    private final JdbcTemplate jdbc;
    private final Mailer mailer;
    private final AuditLog audit;
    private final String portalUrl;
    public ConversationDigest(JdbcTemplate jdbc, Mailer mailer, AuditLog audit,
                              @Value("${vedal.notifications.portal-url}") String portalUrl) {
        this.jdbc = jdbc; this.mailer = mailer; this.audit = audit; this.portalUrl = portalUrl;
    }

    @Transactional
    public boolean queue(LocalDate date) {
        var cutoff = date.atTime(9, 0).atZone(ZoneId.of("Europe/Moscow")).toInstant();
        Map<String, Long> stages = new LinkedHashMap<>();
        jdbc.query("""
                select stage, count(*) as total from conversation where erased_at is null
                and (stage <> 'closed' or board_updated_at >= ?) group by stage
                """, rs -> { stages.put(rs.getString("stage"), rs.getLong("total")); },
                java.sql.Timestamp.from(cutoff.minus(Duration.ofDays(1))));
        long urgent = jdbc.queryForObject("select count(*) from conversation where erased_at is null and stage <> 'closed' and importance = 'urgent'", Long.class);
        long unassigned = jdbc.queryForObject("select count(*) from conversation where erased_at is null and stage <> 'closed' and owner is null", Long.class);
        boolean queued = mailer.queueConversationDigest(date, portalUrl, stages, urgent, unassigned);
        if (queued) audit.record("system", "chat.digest.queued", "conversation_digest", date.toString(), Map.of());
        return queued;
    }
}
