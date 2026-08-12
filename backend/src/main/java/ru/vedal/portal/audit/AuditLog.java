package ru.vedal.portal.audit;

import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import ru.vedal.portal.common.CorrelationId;

import java.util.Map;
import java.util.UUID;

// Единственный вход в журнал. Пишет в транзакции вызывающего: запись журнала
// и действие, которое она описывает, должны коммититься вместе — иначе журнал
// расходится с реальностью именно в тот момент, когда он нужен.
@Service
public class AuditLog {

    private final AuditEntryRepository entries;
    private final ObjectMapper json;

    public AuditLog(AuditEntryRepository entries, ObjectMapper json) {
        this.entries = entries;
        this.json = json;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(String actor, String action, String subject, String subjectId,
                       Map<String, ?> payload) {
        write(actor, action, subject, subjectId, payload);
    }

    // Запись в собственной транзакции — для случаев, когда вызывающий сразу
    // после этого валит свою. Отказ в доступе к закрытому файлу заканчивается
    // исключением, и запись, сделанная в общей транзакции, откатилась бы вместе
    // с ним: попытка не осталась бы в журнале вообще.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordIndependently(String actor, String action, String subject, String subjectId,
                                    Map<String, ?> payload) {
        write(actor, action, subject, subjectId, payload);
    }

    private void write(String actor, String action, String subject, String subjectId,
                       Map<String, ?> payload) {
        var entry = new AuditEntry();
        entry.setId(UUID.randomUUID());
        entry.setActor(actor);
        entry.setAction(action);
        entry.setSubject(subject);
        entry.setSubjectId(subjectId);
        entry.setCorrelationId(CorrelationId.current());
        entry.setIp(clientIp());
        entry.setPayload(serialize(payload));
        entries.save(entry);
    }

    private String serialize(Map<String, ?> payload) {
        if (payload == null || payload.isEmpty()) return null;
        try {
            return json.writeValueAsString(payload);
        } catch (Exception e) {
            // Журнал важнее подробностей: пишем запись с пометкой,
            // а не теряем сам факт действия из-за неудачной сериализации.
            return "{\"serializationFailed\":true}";
        }
    }

    // Персональные данные в журнал не пишем, адрес — пишем: без него
    // инцидент не разобрать. Он корректен только при настроенном
    // server.forward-headers-strategy, иначе здесь окажется адрес прокси.
    private static String clientIp() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            HttpServletRequest request = attrs.getRequest();
            return request.getRemoteAddr();
        }
        return null;
    }
}
