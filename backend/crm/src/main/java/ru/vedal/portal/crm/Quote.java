package ru.vedal.portal.crm;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

// Коммерческое предложение.
//
// Правится только пока оно черновик. Отправленное КП — документ, который
// у клиента уже есть; правка задним числом означала бы, что портал и клиент
// держат разные версии одного предложения и спорят о том, чья настоящая.
// Нужны другие условия — заводится новое КП.
@Entity
public class Quote {

    @Id
    private UUID id;

    @Column(name = "deal_id")
    private UUID dealId;

    // Номер, который клиент видит в переписке.
    private String number;

    // draft | sent | accepted | rejected | expired
    private String status;

    private String currency = "RUB";

    @Column(name = "valid_until")
    private LocalDate validUntil;

    private String note;

    // Сумма считается из позиций и хранится: отправленное КП обязано
    // показывать ту сумму, которая в нём была, а не пересчитанную сегодня.
    private BigDecimal total = BigDecimal.ZERO;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "decided_at")
    private Instant decidedAt;

    // Позиции заменяются целиком, как характеристики изделия: редактор видит
    // их одним списком и удаляет строку удалением строки. orphanRemoval
    // убирает осиротевшие записи.
    //
    // nullable = false обязателен: у однонаправленной связи «один ко многим»
    // с join-колонкой Hibernate иначе сначала отвязывает осиротевшую строку
    // (`update quote_item set quote_id = null`) и только потом удаляет —
    // а колонка объявлена not null, и правка падает пятисотой.
    //
    // @OptimisticLock(excluded = true) — не оптимизация, а починка контракта.
    // По умолчанию изменение коллекции поднимает версию владельца отдельным
    // шагом, уже ПОСЛЕ того, как ответ собран: карточка уезжала редактору
    // с версией 0, в базе оставалась 1, и первое же сохранение получало 409
    // на пустом месте. Версия и без коллекции двигается на каждой правке —
    // updated_at меняется в том же запросе, что и позиции.
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "quote_id", nullable = false)
    @OrderBy("position asc")
    @org.hibernate.annotations.OptimisticLock(excluded = true)
    private List<QuoteItem> items = new ArrayList<>();

    @Version
    private long version;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getDealId() { return dealId; }
    public void setDealId(UUID dealId) { this.dealId = dealId; }
    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public LocalDate getValidUntil() { return validUntil; }
    public void setValidUntil(LocalDate validUntil) { this.validUntil = validUntil; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public BigDecimal getTotal() { return total; }
    public void setTotal(BigDecimal total) { this.total = total; }
    public Instant getSentAt() { return sentAt; }
    public void setSentAt(Instant sentAt) { this.sentAt = sentAt; }
    public Instant getDecidedAt() { return decidedAt; }
    public void setDecidedAt(Instant decidedAt) { this.decidedAt = decidedAt; }
    public List<QuoteItem> getItems() { return items; }
    public long getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
