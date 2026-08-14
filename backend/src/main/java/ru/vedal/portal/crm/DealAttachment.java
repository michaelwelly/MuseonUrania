package ru.vedal.portal.crm;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

// Приложенный к сделке документ.
//
// Значение, а не сущность: у него нет своей жизни отдельно от сделки, и
// удаление сделки уносит его с собой. Хранится идентификатор карточки
// документа, а не файл: копия разошлась бы с оригиналом при первой же
// замене ревизии, и клиент получил бы устаревшую редакцию.
//
// Прикладывать можно только согласованный документ — проверка стоит
// в DealDesk. База её не сторожит намеренно: документ могут снять
// с публикации позже, и это не повод задним числом отцеплять его от сделки,
// в которой он уже уехал клиенту.
@Embeddable
public class DealAttachment {

    @Column(name = "document_id")
    private UUID documentId;

    @Column(name = "attached_by")
    private String attachedBy;

    @Column(name = "attached_at")
    private Instant attachedAt = Instant.now();

    protected DealAttachment() {}

    DealAttachment(UUID documentId, String attachedBy) {
        this.documentId = documentId;
        this.attachedBy = attachedBy;
        this.attachedAt = Instant.now();
    }

    public UUID getDocumentId() { return documentId; }
    public String getAttachedBy() { return attachedBy; }
    public Instant getAttachedAt() { return attachedAt; }

    // Пара (сделка, документ) — первичный ключ в схеме. Равенство по документу
    // держит ту же границу на стороне Hibernate: без него удаление одного
    // вложения из коллекции сносило бы не ту строку.
    @Override
    public boolean equals(Object other) {
        return other instanceof DealAttachment that && Objects.equals(documentId, that.documentId);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(documentId);
    }
}
