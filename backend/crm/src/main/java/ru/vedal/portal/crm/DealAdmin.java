package ru.vedal.portal.crm;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import ru.vedal.portal.common.PageView;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

// Дверь модуля к сделкам — всем трём воронкам сразу.
//
// Суммы и условия здесь — коммерческая тайна из раздела «не выносим наружу»
// брифа собственника. Они не уходят ни в публичное API, ни в топики,
// ни в журнал: событие и запись журнала несут идентификатор и стадию.
public interface DealAdmin {

    @Schema(name = "AdminDealRow", description = "Строка списка сделок.")
    record DealRow(UUID id, UUID clientId, String clientName, String pipeline, String title,
                   String stage, BigDecimal amount, String currency, String productSlug,
                   String owner, Instant createdAt, Instant updatedAt) {}

    @Schema(name = "AdminDeal", description = "Карточка сделки вместе с вложениями.")
    record DealView(UUID id,

                    @Schema(description = "Версия карточки. Её надо вернуть в форме правки.")
                    long version,

                    UUID clientId, String clientName,

                    @Schema(description = "Заявка, из которой заведена сделка. Пусто у сделки, "
                            + "заведённой руками.", nullable = true)
                    UUID leadId,

                    String pipeline, String title, String stage,

                    @Schema(description = "Стадии этой воронки, по порядку. Форма рисует выбор "
                            + "из них, а не свободное поле.")
                    List<String> stages,

                    @Schema(description = "Стадии, которыми эта воронка заканчивается успехом.")
                    List<String> wonStages,

                    @Schema(description = "Стадии, которыми эта воронка заканчивается отказом. "
                            + "Перевод в такую стадию требует причины проигрыша: форма "
                            + "спрашивает её до нажатия, а не после отказа.")
                    List<String> lostStages,

                    BigDecimal amount, String currency, String productSlug, String owner,
                    Instant closedAt, String lostReason,
                    List<AttachmentView> attachments,
                    Instant createdAt, Instant updatedAt) {}

    @Schema(name = "AdminDealAttachment", description = """
            Приложенный документ. Хранится ссылка на карточку, а не копия файла:
            копия разошлась бы с оригиналом при замене ревизии.
            """)
    record AttachmentView(UUID documentId, String slug, String title,
                          String attachedBy, Instant attachedAt) {}

    @Schema(name = "AdminNewDeal", description = "Новая сделка по уже заведённому клиенту.")
    record NewDeal(
            @Schema(description = "Клиент, по которому заводится сделка.",
                    requiredMode = Schema.RequiredMode.REQUIRED)
            UUID clientId,

            @Schema(allowableValues = {"sales", "dealer", "service"}, example = "sales")
            @NotBlank String pipeline,

            @Schema(example = "Поставка двух систем VEDAL R2",
                    requiredMode = Schema.RequiredMode.REQUIRED)
            @NotBlank @Size(max = 300) String title,

            @Schema(example = "2650000.00")
            @DecimalMin(value = "0", message = "Сумма не может быть отрицательной")
            BigDecimal amount,

            @Schema(description = "Трёхбуквенный код валюты. Пусто — RUB.", example = "RUB")
            @Pattern(regexp = "^$|^[A-Z]{3}$", message = "Валюта — три заглавные буквы")
            String currency,

            String productSlug,
            @Size(max = 200) String owner) {}

    @Schema(name = "AdminLeadConversion", description = """
            Разбор заявки в сделку. Клиент либо указывается существующий,
            либо заводится из данных заявки.
            """)
    record Conversion(
            @Schema(description = "Существующий клиент. Пусто — карточка клиента заводится "
                    + "из данных заявки. Портал не ищет совпадения сам: слить две карточки "
                    + "потом можно, разделить ошибочно слитые — уже нет.", nullable = true)
            UUID clientId,

            @Schema(allowableValues = {"sales", "dealer", "service"}, example = "sales")
            @NotBlank String pipeline,

            @Schema(description = "Название сделки. Пусто — берётся из формы и изделия заявки.",
                    nullable = true)
            @Size(max = 300) String title,

            @DecimalMin(value = "0", message = "Сумма не может быть отрицательной")
            BigDecimal amount,

            @Size(max = 200) String owner) {}

    @Schema(name = "AdminDealForm", description = "Правка карточки сделки. Стадия меняется отдельно.")
    record DealForm(
            @Schema(description = "Версия прочитанной карточки.", nullable = true)
            Long version,

            @Schema(example = "Поставка двух систем VEDAL R2",
                    requiredMode = Schema.RequiredMode.REQUIRED)
            @NotBlank @Size(max = 300) String title,

            @Schema(example = "2650000.00")
            @DecimalMin(value = "0", message = "Сумма не может быть отрицательной")
            BigDecimal amount,

            @Pattern(regexp = "^$|^[A-Z]{3}$", message = "Валюта — три заглавные буквы")
            String currency,

            String productSlug,
            @Size(max = 200) String owner) {}

    @Schema(name = "AdminDealStage", description = """
            Перевод сделки на другую стадию. Воронка не меняется: сделка,
            переехавшая из продаж в сервис, — это две разные сделки.
            """)
    record StageChange(
            @Schema(description = "Стадия из воронки этой сделки. Список приходит в карточке "
                    + "и в `GET /deals/pipelines`.",
                    example = "qualified", requiredMode = Schema.RequiredMode.REQUIRED)
            @NotBlank String stage,

            @Schema(description = "Причина проигрыша. Обязательна при переводе в проигранную "
                    + "стадию: воронка без причин показывает, сколько потеряли, и молчит "
                    + "о том, почему.", nullable = true)
            @Size(max = 500) String lostReason) {}

    @Schema(name = "AdminDealAttach", description = "Приложить согласованный документ к сделке.")
    record Attach(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID documentId) {}

    /** Воронки и их стадии — чтобы форма нарисовала выбор. */
    record PipelineView(String pipeline, List<String> stages,

                        @Schema(description = "Стадии, которыми эта воронка заканчивается "
                                + "успехом.")
                        List<String> wonStages,

                        @Schema(description = "Стадии, которыми она заканчивается отказом. "
                                + "Чем воронка кончается — правило домена, и форма берёт его "
                                + "отсюда: список, переписанный в интерфейс, разъезжается "
                                + "с доменом на первой же новой воронке.")
                        List<String> lostStages) {}

    List<PipelineView> pipelines();

    PageView<DealRow> deals(String pipeline, String stage, UUID clientId, int page, int size);

    DealView deal(UUID id);

    DealView create(NewDeal form, String actor);

    DealView convert(UUID leadId, Conversion form, String actor);

    DealView update(UUID id, DealForm form, String actor);

    DealView moveTo(UUID id, StageChange change, String actor);

    DealView attach(UUID id, Attach attach, String actor);

    DealView detach(UUID id, UUID documentId, String actor);
}
