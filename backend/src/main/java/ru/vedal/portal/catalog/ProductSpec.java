package ru.vedal.portal.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "product_spec")
public class ProductSpec {

    @Id
    private UUID id;

    // key_param — четыре строки под заголовком карточки, spec — таблица характеристик.
    private String kind;

    @Column(name = "position")
    private int position;

    private String label;
    private String value;
    private boolean muted;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
    public boolean isMuted() { return muted; }
    public void setMuted(boolean muted) { this.muted = muted; }
}
