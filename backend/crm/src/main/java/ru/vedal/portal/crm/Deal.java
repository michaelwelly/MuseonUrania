package ru.vedal.portal.crm;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

// Сделка. Одна таблица на три воронки — продажи, дилерскую и сервисную:
// у них общая карточка, общий ответственный, общая история и общая аналитика.
// Развести их на три сущности значит трижды написать одно и то же и трижды
// же чинить.
//
// Отличаются они набором стадий, и это закрыто ограничением deal_stage_check
// в схеме: стадия из чужой воронки не сохранится.
@Entity
public class Deal {

    @Id
    private UUID id;

    // Ссылки на клиента и заявку держим идентификаторами, а не @ManyToOne
    // на Lead: карточка сделки читается без подтягивания заявки со всеми её
    // персональными данными, а список сделок — без второго запроса на строку.
    @Column(name = "client_id")
    private UUID clientId;

    // Пусто у сделки, заведённой руками: её никто не приводил, и в аналитике
    // источника у неё нет.
    @Column(name = "lead_id")
    private UUID leadId;

    private String pipeline;
    private String title;
    private String stage;

    // Коммерческие условия. Наружу не уходят никогда.
    private BigDecimal amount;
    private String currency = "RUB";

    @Column(name = "product_slug")
    private String productSlug;

    private String owner;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "lost_reason")
    private String lostReason;

    // Вложения — значения, а не сущности: они принадлежат сделке и живут
    // ровно столько же. Ссылка на карточку документа, а не копия файла:
    // копия разошлась бы с оригиналом на первой замене ревизии.
    // @OptimisticLock(excluded = true) по той же причине, что у позиций КП:
    // иначе версия владельца поднимается уже после того, как ответ собран,
    // и следующая правка карточки получает 409 на пустом месте. Версия
    // двигается и без этого — updated_at меняется в том же запросе.
    @ElementCollection
    @CollectionTable(name = "deal_document", joinColumns = @JoinColumn(name = "deal_id"))
    @OrderBy("attachedAt asc")
    @org.hibernate.annotations.OptimisticLock(excluded = true)
    private List<DealAttachment> attachments = new ArrayList<>();

    @Version
    private long version;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getClientId() { return clientId; }
    public void setClientId(UUID clientId) { this.clientId = clientId; }
    public UUID getLeadId() { return leadId; }
    public void setLeadId(UUID leadId) { this.leadId = leadId; }
    public String getPipeline() { return pipeline; }
    public void setPipeline(String pipeline) { this.pipeline = pipeline; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getStage() { return stage; }
    public void setStage(String stage) { this.stage = stage; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getProductSlug() { return productSlug; }
    public void setProductSlug(String productSlug) { this.productSlug = productSlug; }
    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }
    public Instant getClosedAt() { return closedAt; }
    public void setClosedAt(Instant closedAt) { this.closedAt = closedAt; }
    public String getLostReason() { return lostReason; }
    public void setLostReason(String lostReason) { this.lostReason = lostReason; }
    public List<DealAttachment> getAttachments() { return attachments; }
    public long getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
