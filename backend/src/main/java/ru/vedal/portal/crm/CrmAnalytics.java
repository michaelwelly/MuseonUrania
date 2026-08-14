package ru.vedal.portal.crm;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

// Аналитика по изделию, источнику, языку и кампании — четыре разреза
// из functional_requirements.
//
// Считается по заявкам, а не по сделкам, и это не мелочь: атрибуция —
// свойство того, откуда человек пришёл. Сделка, заведённая руками, в отчёт
// не попадает, потому что её никто не приводил, и приписывать её кампании
// значит завысить эффект кампании.
public interface CrmAnalytics {

    List<String> DIMENSIONS = List.of("product", "source", "language", "campaign");

    @Schema(name = "CrmAnalyticsRow", description = "Строка отчёта: один разрез.")
    record Row(
            @Schema(description = "Значение разреза. «—», если оно не заполнено: заявки "
                    + "без кампании — это тоже ответ, и прятать их значит завысить долю "
                    + "тех, у кого кампания есть.")
            String key,

            long leads, long deals, long won, long lost,

            @Schema(description = "Сумма выигранных сделок. Коммерческие условия — наружу "
                    + "этот отчёт не отдаётся ни в каком виде.")
            BigDecimal wonAmount) {}

    @Schema(name = "CrmAnalyticsTotals", description = "Итог по всем строкам отчёта.")
    record Totals(long leads, long deals, long won, long lost, BigDecimal wonAmount) {}

    @Schema(name = "CrmAnalytics", description = "Отчёт по одному разрезу за период.")
    record Report(
            @Schema(allowableValues = {"product", "source", "language", "campaign"})
            String by,

            @Schema(description = "Начало периода включительно. Пусто — с самого начала.",
                    nullable = true)
            LocalDate from,

            @Schema(description = "Конец периода включительно. Пусто — по сегодня.",
                    nullable = true)
            LocalDate to,

            List<Row> rows,
            Totals totals) {}

    Report report(String by, LocalDate from, LocalDate to);
}
