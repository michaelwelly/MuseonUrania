package ru.vedal.portal.crm;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

// Клиент — организация или человек, с которым ведётся работа.
//
// Отдельно от заявки намеренно: заявок от одной больницы бывает десять,
// клиент один. Держать их в одной таблице значит терять историю отношений
// на второй же заявке.
//
// Контакты здесь — персональные данные. Наружу они не уходят: ни в публичное
// API, ни в топики, ни в журнал.
@Entity
public class Client {

    @Id
    private UUID id;

    private String name;

    // company | person. Проверено ограничением схемы.
    private String kind;

    // Реквизиты под будущий обмен с 1С. Сама интеграция не подтверждена —
    // это открытый вопрос 12.4 в docs/PROJECT.md.
    private String inn;
    private String kpp;

    // Идентификатор той же организации во внешней системе.
    @Column(name = "external_id")
    private String externalId;

    private String country;
    private String city;

    private String email;
    private String phone;

    private String note;
    private String owner;

    @Version
    private long version;

    // Уничтожение персональных данных карточки. У организации это почта,
    // телефон и заметка; у частного лица — ещё и наименование.
    @Column(name = "erased_at")
    private Instant erasedAt;

    @Column(name = "erasure_basis")
    private String erasureBasis;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }
    public String getInn() { return inn; }
    public void setInn(String inn) { this.inn = inn; }
    public String getKpp() { return kpp; }
    public void setKpp(String kpp) { this.kpp = kpp; }
    public String getExternalId() { return externalId; }
    public void setExternalId(String externalId) { this.externalId = externalId; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }
    public long getVersion() { return version; }
    public Instant getErasedAt() { return erasedAt; }
    public void setErasedAt(Instant erasedAt) { this.erasedAt = erasedAt; }
    public String getErasureBasis() { return erasureBasis; }
    public void setErasureBasis(String erasureBasis) { this.erasureBasis = erasureBasis; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
