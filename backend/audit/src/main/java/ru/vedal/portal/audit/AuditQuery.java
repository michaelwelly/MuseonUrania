package ru.vedal.portal.audit;

import io.swagger.v3.oas.annotations.media.Schema;
import ru.vedal.portal.common.PageView;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

// Чтение журнала. Записи в журнал идут только через AuditLog, отсюда журнал
// нельзя ни поправить, ни удалить — на уровне базы это закрыто триггером.
public interface AuditQuery {

    @Schema(name = "AuditEntry", description = "Запись журнала.")
    record Entry(UUID id, Instant at, String actor, String action, String subject, String subjectId,
                 String correlationId, String ip,
                 @Schema(description = "Подробности действия в JSON. Персональных данных здесь "
                         + "нет: в журнал пишутся идентификаторы, а не имена и адреса.",
                         nullable = true)
                 String payload) {}

    PageView<Entry> entries(String subject, String subjectId, String actor, int page, int size);

    // Весь путь одной заявки: цепочка собирается по correlation_id, который
    // переживает границу планировщика и потока relay.
    List<Entry> chain(String correlationId);
}
