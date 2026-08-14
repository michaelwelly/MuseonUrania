package ru.vedal.portal.crm;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;

import java.time.Instant;
import java.util.UUID;

// Запись истории: звонок, письмо, встреча или заметка.
//
// Колонки version здесь нет, и это решение, а не упущение: история только
// дописывается. Запись переписки, которую можно поправить задним числом,
// перестаёт быть историей ровно в тот момент, когда она нужна — при разборе
// спора о том, что клиенту обещали. По той же причине append-only сделан
// журнал аудита.
//
// Текст записи — персональные данные: в топики и в журнал он не уезжает,
// туда идёт только идентификатор.
@Entity
public class Interaction {

    @Id
    private UUID id;

    @Column(name = "deal_id")
    private UUID dealId;

    @Column(name = "client_id")
    private UUID clientId;

    @Column(name = "lead_id")
    private UUID leadId;

    // call | email | meeting | note
    private String kind;

    // in | out. Пусто у заметки: у неё нет направления.
    private String direction;

    @Column(name = "at")
    private Instant at = Instant.now();

    private String subject;
    private String body;

    // Кто записал. Не «кто звонил»: звонить мог кто угодно, а запись
    // в истории сделал конкретный человек, и спрашивать надо с него.
    private String actor;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getDealId() { return dealId; }
    public void setDealId(UUID dealId) { this.dealId = dealId; }
    public UUID getClientId() { return clientId; }
    public void setClientId(UUID clientId) { this.clientId = clientId; }
    public UUID getLeadId() { return leadId; }
    public void setLeadId(UUID leadId) { this.leadId = leadId; }
    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }
    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }
    public Instant getAt() { return at; }
    public void setAt(Instant at) { this.at = at; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public String getActor() { return actor; }
    public void setActor(String actor) { this.actor = actor; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
