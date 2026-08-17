package ru.vedal.portal.common;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "event_consumed")
public class EventConsumed {

    @Id
    private UUID id;

    private String consumer;

    @Column(name = "event_id")
    private UUID eventId;

    @Column(name = "at")
    private Instant at = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getConsumer() { return consumer; }
    public void setConsumer(String consumer) { this.consumer = consumer; }
    public UUID getEventId() { return eventId; }
    public void setEventId(UUID eventId) { this.eventId = eventId; }
    public Instant getAt() { return at; }
    public void setAt(Instant at) { this.at = at; }
}
