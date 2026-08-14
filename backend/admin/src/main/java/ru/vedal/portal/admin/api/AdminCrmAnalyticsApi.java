package ru.vedal.portal.admin.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.vedal.portal.crm.CrmAnalytics;

import java.time.LocalDate;
import java.util.List;

// Аналитика воронки: по изделию, источнику, языку и кампании.
//
// Отчёт считается по заявкам: атрибуция — свойство того, откуда человек
// пришёл. Сделка, заведённая руками, в разрезы не попадает, и это правильно —
// её никто не приводил.
@RestController
@RequestMapping("/api/admin/v1")
@Tag(name = "Админка: аналитика CRM")
@SecurityRequirement(name = "keycloak")
public class AdminCrmAnalyticsApi {

    private final CrmAnalytics analytics;

    public AdminCrmAnalyticsApi(CrmAnalytics analytics) {
        this.analytics = analytics;
    }

    @Operation(summary = "Разрезы отчёта")
    @GetMapping("/analytics/dimensions")
    public List<String> dimensions() {
        return CrmAnalytics.DIMENSIONS;
    }

    @Operation(summary = "Воронка в одном разрезе за период",
            description = """
                    Считается по заявкам с левым соединением на сделку: заявка, не ставшая
                    сделкой, обязана попасть в отчёт — иначе конверсия везде равна единице.

                    Незаполненное значение разреза показывается как «—», а не прячется:
                    заявки без кампании — это тоже ответ.
                    """)
    @GetMapping("/analytics")
    public CrmAnalytics.Report report(
            @Parameter(description = "Разрез: product, source, language или campaign.")
            @RequestParam(defaultValue = "source") String by,

            @Parameter(description = "Начало периода включительно, `YYYY-MM-DD`. Пусто — с начала.")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @Parameter(description = "Конец периода включительно, `YYYY-MM-DD`. Пусто — по сегодня.")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return analytics.report(by, from, to);
    }
}
