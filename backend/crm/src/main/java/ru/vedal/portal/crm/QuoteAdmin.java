package ru.vedal.portal.crm;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import ru.vedal.portal.common.PageView;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// Дверь модуля к коммерческим предложениям.
//
// Цены сюда вносит менеджер. Правило «не выдумывать цены» из раздела 9
// PROJECT.md на КП тоже действует, но иначе: цену здесь называет человек,
// и наружу — на сайт, в каталог, в ответы Ведалины — она не попадает никогда.
public interface QuoteAdmin {

    List<String> STATUSES = List.of("draft", "sent", "accepted", "rejected", "expired");

    @Schema(name = "AdminQuoteRow", description = "Строка списка КП.")
    record QuoteRow(UUID id, UUID dealId, String dealTitle, String number, String status,
                    BigDecimal total, String currency, LocalDate validUntil,
                    Instant sentAt, Instant createdAt) {}

    @Schema(name = "AdminQuote", description = "КП целиком, вместе с позициями.")
    record QuoteView(UUID id,

                     @Schema(description = "Версия карточки. Её надо вернуть в форме правки.")
                     long version,

                     UUID dealId, String dealTitle, String number, String status,
                     BigDecimal total, String currency, LocalDate validUntil, String note,
                     List<ItemView> items,
                     Instant sentAt, Instant decidedAt, Instant createdAt, Instant updatedAt) {}

    @Schema(name = "AdminQuoteItem", description = "Позиция КП.")
    record ItemView(String productSlug, String name, BigDecimal quantity,
                    BigDecimal unitPrice, BigDecimal amount) {}

    @Schema(name = "AdminQuoteItemForm", description = "Позиция в форме КП. Сумму считает портал.")
    record ItemForm(
            @Schema(description = "Позиция каталога. Пусто у монтажа, обучения и доставки.",
                    nullable = true)
            String productSlug,

            @Schema(description = "Наименование в КП. Хранится своё, а не берётся из каталога "
                    + "по ссылке: переименование изделия не должно задним числом менять уже "
                    + "отправленное предложение.",
                    example = "Реанимационная система для новорождённых VEDAL R2",
                    requiredMode = Schema.RequiredMode.REQUIRED)
            @NotBlank(message = "Укажите наименование позиции")
            @Size(max = 300) String name,

            @Schema(example = "2")
            @DecimalMin(value = "0.001", message = "Количество должно быть больше нуля")
            BigDecimal quantity,

            @Schema(example = "1250000.00")
            @DecimalMin(value = "0", message = "Цена не может быть отрицательной")
            BigDecimal unitPrice) {}

    @Schema(name = "AdminNewQuote", description = "Новое КП по сделке.")
    record NewQuote(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID dealId,

            @Pattern(regexp = "^$|^[A-Z]{3}$", message = "Валюта — три заглавные буквы")
            String currency,

            LocalDate validUntil,
            String note,

            @Valid List<ItemForm> items) {}

    @Schema(name = "AdminQuoteForm", description = """
            Правка КП. Позиции заменяются целиком: редактор видит их одним
            списком и удаляет строку удалением строки.
            """)
    record QuoteForm(
            @Schema(description = "Версия прочитанной карточки.", nullable = true)
            Long version,

            @Pattern(regexp = "^$|^[A-Z]{3}$", message = "Валюта — три заглавные буквы")
            String currency,

            LocalDate validUntil,
            String note,

            @NotEmpty(message = "КП без позиций отправлять нечего")
            @Valid List<ItemForm> items) {}

    @Schema(name = "AdminQuoteDecision", description = "Решение клиента по отправленному КП.")
    record Decision(
            @Schema(allowableValues = {"accepted", "rejected", "expired"}, example = "accepted")
            @NotBlank
            @Pattern(regexp = "accepted|rejected|expired", message = "Решение: accepted, rejected или expired")
            String status) {}

    PageView<QuoteRow> quotes(String status, int page, int size);

    List<QuoteRow> byDeal(UUID dealId);

    QuoteView quote(UUID id);

    QuoteView create(NewQuote form, String actor);

    QuoteView update(UUID id, QuoteForm form, String actor);

    QuoteView send(UUID id, String actor);

    QuoteView decide(UUID id, Decision decision, String actor);
}
