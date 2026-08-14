package ru.vedal.portal.audit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import ru.vedal.portal.PostgresTestBase;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuditLogTest extends PostgresTestBase {

    @Autowired
    AuditLog audit;

    @Autowired
    AuditEntryRepository entries;

    @Autowired
    JdbcClient jdbc;

    @Test
    void recordsActorActionAndCorrelation() {
        audit.record("editor", "product.unpublish", "product", "audit-probe",
                Map.of("reason", "проверка"));

        var found = entries.findBySubjectAndSubjectIdOrderByAtDesc("product", "audit-probe");

        assertThat(found).hasSize(1);
        var entry = found.getFirst();
        assertThat(entry.getActor()).isEqualTo("editor");
        assertThat(entry.getAction()).isEqualTo("product.unpublish");
        assertThat(entry.getCorrelationId()).isNotBlank();
        assertThat(entry.getPayload()).contains("reason");
    }

    // Триггер объявлен FOR EACH STATEMENT, поэтому срабатывает на самом операторе
    // и строки для проверки не нужны.
    @Test
    void journalRejectsUpdate() {
        assertThatThrownBy(() -> jdbc.sql("update audit_entry set actor = 'someone-else'").update())
                .hasMessageContaining("append-only");
    }

    @Test
    void journalRejectsDelete() {
        assertThatThrownBy(() -> jdbc.sql("delete from audit_entry").update())
                .hasMessageContaining("append-only");
    }
}
