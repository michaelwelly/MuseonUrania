package ru.vedal.portal.common;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "outbox")
public class Outbox {

    @Id
    private UUID id;

    // Кто породил событие: имя агрегата и его идентификатор.
    private String aggregate;

    @Column(name = "aggregate_id")
    private String aggregateId;

    private String type;

    @JdbcTypeCode(SqlTypes.JSON)
    private String payload;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    // null означает «ещё не отправлено». По этому полю работает relay.
    @Column(name = "published_at")
    private Instant publishedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getAggregate() { return aggregate; }
    public void setAggregate(String aggregate) { this.aggregate = aggregate; }
    public String getAggregateId() { return aggregateId; }
    public void setAggregateId(String aggregateId) { this.aggregateId = aggregateId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getPayload() { return payload; }
    public void setPayload(String payload) { this.payload = payload; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }
}
