package ru.vedal.portal.documents;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "document")
public class Document {

    @Id
    private UUID id;
    private String slug;
    private String title;

    @Column(name = "doc_group")
    private String docGroup;

    private String subject;

    @Column(name = "product_slug")
    private String productSlug;

    // public | internal | confidential. Опубликовать можно только public —
    // это проверяется в схеме, а не здесь.
    private String sensitivity;

    // pdf | on_request | pending — бейдж доступа на сайте.
    private String access;

    // listed — строка видна в перечне, published — файл скачивается.
    private boolean listed;
    private boolean published;

    private String language = "ru";

    @Column(name = "storage_key")
    private String storageKey;

    @Column(name = "file_size")
    private Long fileSize;

    private String revision;

    @Column(name = "source_owner")
    private String sourceOwner;

    @Column(name = "approved_by")
    private String approvedBy;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDocGroup() { return docGroup; }
    public void setDocGroup(String docGroup) { this.docGroup = docGroup; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getProductSlug() { return productSlug; }
    public void setProductSlug(String productSlug) { this.productSlug = productSlug; }
    public String getSensitivity() { return sensitivity; }
    public void setSensitivity(String sensitivity) { this.sensitivity = sensitivity; }
    public String getAccess() { return access; }
    public void setAccess(String access) { this.access = access; }
    public boolean isListed() { return listed; }
    public void setListed(boolean listed) { this.listed = listed; }
    public boolean isPublished() { return published; }
    public void setPublished(boolean published) { this.published = published; }
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    public String getStorageKey() { return storageKey; }
    public void setStorageKey(String storageKey) { this.storageKey = storageKey; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public String getRevision() { return revision; }
    public void setRevision(String revision) { this.revision = revision; }
    public String getSourceOwner() { return sourceOwner; }
    public void setSourceOwner(String sourceOwner) { this.sourceOwner = sourceOwner; }
    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
