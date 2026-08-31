package ru.vedal.portal.chat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

// Разговор посетителя с порталом.
//
// Состояний четыре, и разница между open и waiting — главная из них:
//
//   open     — идёт, отвечает Ведалина;
//   waiting  — Ведалина передала человеку, сотрудник ещё не подключился;
//   attended — сотрудник в разговоре;
//   closed   — завершён.
//
// waiting отделён намеренно: это единственное состояние, где человек ждёт
// живого ответа, и очередь работы сотрудника строится по нему. Слить его
// с open значит превратить очередь в список всех разговоров вообще.
@Entity
@Table(name = "conversation")
public class Conversation {

    public static final String OPEN = "open";
    public static final String WAITING = "waiting";
    public static final String ATTENDED = "attended";
    public static final String CLOSED = "closed";

    @Id
    private UUID id;

    // Случайный ключ из браузера. По нему виджет находит свой разговор после
    // перезагрузки страницы. Не идентификатор человека — идентификатор вкладки:
    // о посетителе он не сообщает ничего.
    @Column(name = "visitor_key")
    private String visitorKey;

    private String language;
    private String campaign;
    private String page;

    private String status = OPEN;
    private String owner;

    @Column(name = "lead_id")
    private UUID leadId;

    // Номер заявки, заведённой из разговора. Снимок, а не связь: `chat` и `crm`
    // друг о друге не знают, и достать номер по идентификатору отсюда нечем.
    // Показывается посетителю в ленте — это единственное, что он унёс с собой.
    @Column(name = "lead_number")
    private String leadNumber;

    @Column(name = "erased_at")
    private Instant erasedAt;

    @Column(name = "erasure_basis")
    private String erasureBasis;

    @Column(name = "started_at")
    private Instant startedAt = Instant.now();

    // Время последнего сообщения. Денормализация ради списка в админке:
    // сортировать разговоры по «кто написал последним» иначе значит считать
    // max(at) по всей таблице сообщений на каждое открытие списка.
    @Column(name = "last_at")
    private Instant lastAt = Instant.now();

    @Version
    private long version;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getVisitorKey() { return visitorKey; }
    public void setVisitorKey(String visitorKey) { this.visitorKey = visitorKey; }
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    public String getCampaign() { return campaign; }
    public void setCampaign(String campaign) { this.campaign = campaign; }
    public String getPage() { return page; }
    public void setPage(String page) { this.page = page; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }
    public UUID getLeadId() { return leadId; }
    public void setLeadId(UUID leadId) { this.leadId = leadId; }
    public String getLeadNumber() { return leadNumber; }
    public void setLeadNumber(String leadNumber) { this.leadNumber = leadNumber; }
    public Instant getErasedAt() { return erasedAt; }
    public void setErasedAt(Instant erasedAt) { this.erasedAt = erasedAt; }
    public String getErasureBasis() { return erasureBasis; }
    public void setErasureBasis(String erasureBasis) { this.erasureBasis = erasureBasis; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getLastAt() { return lastAt; }
    public void setLastAt(Instant lastAt) { this.lastAt = lastAt; }
    public long getVersion() { return version; }
    public void setVersion(long version) { this.version = version; }

    /** Человек уже в разговоре или вызван — Ведалины здесь больше нечего делать. */
    public boolean handedToHuman() {
        return WAITING.equals(status) || ATTENDED.equals(status);
    }
}
