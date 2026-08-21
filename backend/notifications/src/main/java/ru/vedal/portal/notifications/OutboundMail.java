package ru.vedal.portal.notifications;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "outbound_mail")
public class OutboundMail {

    // Статусы письма. Список совпадает с check-ограничением в миграции V7:
    // разойдись они — вставка упала бы, а не завела тихо четвёртое состояние.
    static final String QUEUED = "queued";
    static final String SENT = "sent";
    // failed — это и есть разбор руками: письмо, не ушедшее после всех попыток
    // или отвергнутое окончательно. Из очереди оно больше не берётся.
    static final String FAILED = "failed";

    @Id
    private UUID id;

    private String template;

    @Column(name = "to_address")
    private String toAddress;

    private String subject;
    private String body;

    @Column(name = "lead_id")
    private UUID leadId;

    @Column(name = "correlation_id")
    private String correlationId;

    private String status;
    private int attempts;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    @Column(name = "sent_at")
    private Instant sentAt;

    // Когда письмо можно пробовать снова. Заполнено всегда, а не только
    // у отложенных: у только что поставленного в очередь это момент постановки,
    // и запрос «что пора отправлять» остаётся одним условием без ветвления
    // на null.
    @Column(name = "next_attempt_at")
    private Instant nextAttemptAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getTemplate() { return template; }
    public void setTemplate(String template) { this.template = template; }
    public String getToAddress() { return toAddress; }
    public void setToAddress(String toAddress) { this.toAddress = toAddress; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public UUID getLeadId() { return leadId; }
    public void setLeadId(UUID leadId) { this.leadId = leadId; }
    public String getCorrelationId() { return correlationId; }
    public void setCorrelationId(String correlationId) { this.correlationId = correlationId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public int getAttempts() { return attempts; }
    public void setAttempts(int attempts) { this.attempts = attempts; }
    public String getLastError() { return lastError; }
    public void setLastError(String lastError) { this.lastError = lastError; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getSentAt() { return sentAt; }
    public void setSentAt(Instant sentAt) { this.sentAt = sentAt; }
    public Instant getNextAttemptAt() { return nextAttemptAt; }
    public void setNextAttemptAt(Instant nextAttemptAt) { this.nextAttemptAt = nextAttemptAt; }
}
