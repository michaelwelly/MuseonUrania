package ru.vedal.portal.crm;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.UUID;

// Позиция коммерческого предложения.
//
// Наименование хранится своё, а не берётся из каталога по ссылке:
// переименование изделия не должно задним числом менять уже отправленное
// предложение. Ссылка на каталог при этом остаётся — по ней считается
// аналитика по изделию.
@Entity
@Table(name = "quote_item")
public class QuoteItem {

    @Id
    private UUID id;

    @Column(name = "position")
    private int position;

    // Пусто у позиций, которых в каталоге нет: монтаж, обучение, доставка.
    @Column(name = "product_slug")
    private String productSlug;

    private String name;

    private BigDecimal quantity;

    @Column(name = "unit_price")
    private BigDecimal unitPrice;

    // Произведение, посчитанное доменом и сохранённое. Считать его на лету
    // при каждом чтении значит однажды получить сумму КП, не совпадающую
    // с той, что видел клиент.
    private BigDecimal amount;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    public String getProductSlug() { return productSlug; }
    public void setProductSlug(String productSlug) { this.productSlug = productSlug; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
}
