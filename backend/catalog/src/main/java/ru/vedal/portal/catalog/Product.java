package ru.vedal.portal.catalog;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
public class Product {

    @Id
    private UUID id;
    private String slug;
    private String name;
    private String kind;
    private String summary;
    private String detail;

    // Назначение изделия — §4.5 плана. Nullable: у всех четырёх позиций
    // текста пока нет, и значение по умолчанию пришлось бы выдумать.
    private String purpose;

    // Статус документации: рисует бейдж на сайте. Это НЕ видимость.
    @Column(name = "doc_status")
    private String docStatus;

    // Видимость снаружи.
    private boolean published;

    @Column(name = "sort_order")
    private int sortOrder;

    @Column(name = "image_src")
    private String imageSrc;

    @Column(name = "image_alt")
    private String imageAlt;

    // Версия строки. Её ведёт Hibernate: одновременная запись двумя
    // транзакциями заканчивается отказом второй, а не тихой перезаписью.
    @Version
    private long version;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();

    @ManyToMany
    @JoinTable(name = "product_category",
            joinColumns = @JoinColumn(name = "product_id"),
            inverseJoinColumns = @JoinColumn(name = "category_id"))
    private List<Category> categories = new ArrayList<>();

    // nullable = false здесь обязателен, и это не украшение схемы.
    //
    // У однонаправленной связи «один ко многим» с join-колонкой Hibernate
    // по умолчанию считает, что осиротевшую строку можно отвязать: он делает
    // `update product_spec set product_id = null`, и только потом удаляет.
    // Колонка объявлена not null, поэтому первый же запрос падает — то есть
    // правка изделия, у которого есть характеристики, заканчивалась пятисотой.
    //
    // С nullable = false Hibernate знает, что отвязать строку нельзя, и сразу
    // удаляет её. Ровно то, что нужно: характеристика без изделия не существует.
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "product_id", nullable = false)
    @OrderBy("position asc")
    private List<ProductSpec> specs = new ArrayList<>();

    // nullable = false по той же причине, что у specs выше: без него Hibernate
    // пытается отвязать осиротевшую строку через product_id = null и падает
    // на not null.
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "product_id", nullable = false)
    @OrderBy("position asc")
    private List<ProductFeature> features = new ArrayList<>();

    public long getVersion() { return version; }
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
    public String getPurpose() { return purpose; }
    public void setPurpose(String purpose) { this.purpose = purpose; }
    public String getDocStatus() { return docStatus; }
    public void setDocStatus(String docStatus) { this.docStatus = docStatus; }
    public boolean isPublished() { return published; }
    public void setPublished(boolean published) { this.published = published; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public String getImageSrc() { return imageSrc; }
    public void setImageSrc(String imageSrc) { this.imageSrc = imageSrc; }
    public String getImageAlt() { return imageAlt; }
    public void setImageAlt(String imageAlt) { this.imageAlt = imageAlt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public List<Category> getCategories() { return categories; }
    public void setCategories(List<Category> categories) { this.categories = categories; }
    public List<ProductSpec> getSpecs() { return specs; }
    public List<ProductFeature> getFeatures() { return features; }
    public void setSpecs(List<ProductSpec> specs) { this.specs = specs; }
}
