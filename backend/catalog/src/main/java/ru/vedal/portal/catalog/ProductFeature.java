package ru.vedal.portal.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/**
 * Ключевая особенность изделия — одна строка списка на карточке (§4.5 плана).
 *
 * Почему не ProductSpec с kind = 'feature': у особенности нет пары
 * «метка — значение». Это одно утверждение, и в product_spec оно легло бы
 * в label с пустой строкой в обязательной колонке value.
 */
@Entity
@Table(name = "product_feature")
public class ProductFeature {

    @Id
    private UUID id;

    @Column(name = "position")
    private int position;

    private String body;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
}
