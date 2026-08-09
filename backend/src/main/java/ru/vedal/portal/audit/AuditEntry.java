package ru.vedal.portal.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

// Запись журнала. Сеттеров на изменение существующей записи нет намеренно:
// журнал только дописывается, а на уровне базы это закрыто триггером.
@Entity
@Table(name = "audit_entry")
public class AuditEntry {

    @Id
    private UUID id;

    @Column(name = "at")
    private Instant at = Instant.now();

    private String actor;
    private String action;
    private String subject;

    @Column(name = "subject_id")
    private String subjectId;

    @Column(name = "correlation_id")
    private String correlationId;

    private String ip;

    @JdbcTypeCode(SqlTypes.JSON)
    private String payload;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public Instant getAt() { return at; }
    public void setAt(Instant at) { this.at = at; }
    public String getActor() { return actor; }
    public void setActor(String actor) { this.actor = actor; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getSubjectId() { return subjectId; }
    public void setSubjectId(String subjectId) { this.subjectId = subjectId; }
    public String getCorrelationId() { return correlationId; }
    public void setCorrelationId(String correlationId) { this.correlationId = correlationId; }
    public String getIp() { return ip; }
    public void setIp(String ip) { this.ip = ip; }
    public String getPayload() { return payload; }
    public void setPayload(String payload) { this.payload = payload; }
}
