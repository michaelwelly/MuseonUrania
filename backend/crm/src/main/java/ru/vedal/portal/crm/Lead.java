package ru.vedal.portal.crm;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "lead")
public class Lead {

    @Id
    private UUID id;

    // Номер, который называют вслух: «З-2026-0042». Внутри системы хватает
    // идентификатора, снаружи — нет: по телефону UUID не продиктуешь,
    // а обращение, заведённое из чата, посетитель запоминает именно номером.
    private String number;

    private String form;
    private String name;
    private String company;
    private String phone;
    private String email;

    @Column(name = "product_slug")
    private String productSlug;

    // Серийный номер изделия из сервисного обращения. Пусто — не указан:
    // номер знают не всегда, и обращение без него — обычное обращение.
    // Формат не проверяется: вид номера VEDAL в подтверждённых материалах
    // не описан, а маска, придуманная здесь, отклоняла бы настоящие номера.
    @Column(name = "serial_number")
    private String serialNumber;

    private String message;

    // Версия текста согласия, а не галочка: через год иначе не доказать,
    // с чем именно согласился человек.
    @Column(name = "consent_version")
    private String consentVersion;

    @Column(name = "consent_at")
    private Instant consentAt;

    private String source;

    // Атрибуция: язык страницы и кампания, с которой пришёл посетитель.
    // Свойство того, откуда человек пришёл, — поэтому здесь, а не в сделке.
    // Без них два из четырёх разрезов аналитики посчитать нечем.
    private String language;
    private String campaign;

    private String status;
    private String owner;

    @Column(name = "correlation_id")
    private String correlationId;

    @Column(name = "idempotency_key")
    private String idempotencyKey;

    // Когда персональные данные заявки уничтожены и на каком основании.
    // Пусто — не уничтожались. Обезличенная заявка остаётся единицей учёта:
    // форма, источник, язык и кампания по-прежнему считаются в аналитике,
    // а опознать по ним человека нельзя.
    @Column(name = "erased_at")
    private Instant erasedAt;

    @Column(name = "erasure_basis")
    private String erasureBasis;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }
    public String getForm() { return form; }
    public void setForm(String form) { this.form = form; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCompany() { return company; }
    public void setCompany(String company) { this.company = company; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getProductSlug() { return productSlug; }
    public void setProductSlug(String productSlug) { this.productSlug = productSlug; }
    public String getSerialNumber() { return serialNumber; }
    public void setSerialNumber(String serialNumber) { this.serialNumber = serialNumber; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getConsentVersion() { return consentVersion; }
    public void setConsentVersion(String consentVersion) { this.consentVersion = consentVersion; }
    public Instant getConsentAt() { return consentAt; }
    public void setConsentAt(Instant consentAt) { this.consentAt = consentAt; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    public String getCampaign() { return campaign; }
    public void setCampaign(String campaign) { this.campaign = campaign; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }
    public String getCorrelationId() { return correlationId; }
    public void setCorrelationId(String correlationId) { this.correlationId = correlationId; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public Instant getErasedAt() { return erasedAt; }
    public void setErasedAt(Instant erasedAt) { this.erasedAt = erasedAt; }
    public String getErasureBasis() { return erasureBasis; }
    public void setErasureBasis(String erasureBasis) { this.erasureBasis = erasureBasis; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
