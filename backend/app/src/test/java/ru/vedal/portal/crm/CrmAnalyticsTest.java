package ru.vedal.portal.crm;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.common.ConflictException;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Аналитика по изделию, источнику, языку и кампании.
//
// Считается по заявкам с левым соединением на сделку. Главное, что здесь
// проверяется: заявка, не ставшая сделкой, обязана попасть в отчёт — без неё
// конверсия везде равна единице, и отчёт бесполезен.
class CrmAnalyticsTest extends PostgresTestBase {

    @Autowired
    CrmAnalytics analytics;

    @Autowired
    LeadIntake intake;

    @Autowired
    DealAdmin deals;

    @Autowired
    LeadRepository leads;

    @Autowired
    DealRepository dealRepository;

    @BeforeEach
    void clean() {
        // База между классами общая, и остатки чужих заявок сбили бы счёт.
        // Транзакция теста откатывается, так что уборка живёт только внутри.
        dealRepository.deleteAll();
        leads.deleteAll();
    }

    @Test
    void leadWithoutADealStillCountsInTheReport() {
        accept("a-1", "site", "ru", "innoprom-2026", "vedal-r1");
        accept("a-2", "site", "ru", "innoprom-2026", "vedal-r1");
        win(accept("a-3", "site", "ru", "innoprom-2026", "vedal-r1"), "1000");

        var report = analytics.report("campaign", null, null);

        assertThat(report.rows()).singleElement().satisfies(row -> {
            assertThat(row.key()).isEqualTo("innoprom-2026");
            assertThat(row.leads()).as("все три заявки, а не только ставшая сделкой").isEqualTo(3);
            assertThat(row.deals()).isEqualTo(1);
            assertThat(row.won()).isEqualTo(1);
            assertThat(row.lost()).isZero();
            assertThat(row.wonAmount()).isEqualByComparingTo("1000");
        });
    }

    // Заявки без кампании — это тоже ответ. Спрятать их значит завысить долю
    // тех, у кого кампания есть.
    @Test
    void unattributedLeadsAreShownAsADashAndNotDropped() {
        accept("a-4", "site", "ru", "innoprom-2026", null);
        accept("a-5", "site", "ru", null, null);
        accept("a-6", "site", "ru", null, null);

        var report = analytics.report("campaign", null, null);

        assertThat(report.rows()).extracting(CrmAnalytics.Row::key)
                .containsExactlyInAnyOrder("innoprom-2026", "—");
        assertThat(report.rows()).filteredOn(r -> "—".equals(r.key()))
                .singleElement()
                .satisfies(r -> assertThat(r.leads()).isEqualTo(2));
        assertThat(report.totals().leads()).isEqualTo(3);
    }

    @Test
    void languageSplitsTheFunnel() {
        accept("a-7", "site", "ru", null, null);
        accept("a-8", "site", "en", null, null);
        lose(accept("a-9", "site", "en", null, null));

        var report = analytics.report("language", null, null);

        assertThat(report.rows()).filteredOn(r -> "en".equals(r.key()))
                .singleElement()
                .satisfies(r -> {
                    assertThat(r.leads()).isEqualTo(2);
                    assertThat(r.lost()).isEqualTo(1);
                    assertThat(r.won()).isZero();
                });
        assertThat(report.totals().lost()).isEqualTo(1);
    }

    // Язык приводится к нижнему регистру при приёме: `RU` с одной страницы
    // и `ru` с другой развалили бы разрез на две строки.
    @Test
    void languageCaseDoesNotSplitTheRow() {
        accept("a-10", "site", "RU", null, null);
        accept("a-11", "site", "ru", null, null);

        assertThat(analytics.report("language", null, null).rows())
                .singleElement()
                .satisfies(r -> assertThat(r.key()).isEqualTo("ru"));
    }

    @Test
    void sourceAndProductAreSeparateDimensions() {
        accept("a-12", "site", "ru", null, "vedal-r1");
        accept("a-13", "yandex_form", "ru", null, "vedal-a-2000");

        assertThat(analytics.report("source", null, null).rows())
                .extracting(CrmAnalytics.Row::key)
                .containsExactlyInAnyOrder("site", "yandex_form");
        assertThat(analytics.report("product", null, null).rows())
                .extracting(CrmAnalytics.Row::key)
                .containsExactlyInAnyOrder("vedal-r1", "vedal-a-2000");
    }

    // Успешный исход у каждой воронки свой, и все три обязаны попасть
    // в «выиграно»: иначе отчёт покажет, что сервис за год не закрыл
    // ни одного обращения.
    @Test
    void everyPipelineContributesItsOwnWonStage() {
        win(accept("a-14", "site", "ru", "три-воронки", null), "10");
        winAs(accept("a-15", "site", "ru", "три-воронки", null), "dealer", "active");
        winAs(accept("a-16", "site", "ru", "три-воронки", null), "service", "closed");

        assertThat(analytics.report("campaign", null, null).rows())
                .singleElement()
                .satisfies(r -> assertThat(r.won()).isEqualTo(3));
    }

    @Test
    void unknownDimensionIsRefusedWithTheAllowedList() {
        assertThatThrownBy(() -> analytics.report("manager", null, null))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("campaign");
    }

    // --- вспомогательное -------------------------------------------------

    private UUID accept(String key, String source, String language, String campaign, String product) {
        return intake.accept(new LeadIntake.Draft("quote", "Иван Петров", "Клиника " + key,
                "+7 343 555-22-11", key + "@example.ru", product, null,
                "Прошу коммерческое предложение.", source, language, campaign), key).id();
    }

    private void win(UUID leadId, String amount) {
        var deal = deals.convert(leadId, new DealAdmin.Conversion(null, "sales", null,
                new BigDecimal(amount), "manager"), "manager");
        deals.moveTo(deal.id(), new DealAdmin.StageChange("won", null), "manager");
    }

    private void winAs(UUID leadId, String pipeline, String stage) {
        var deal = deals.convert(leadId, new DealAdmin.Conversion(null, pipeline, null,
                null, "manager"), "manager");
        deals.moveTo(deal.id(), new DealAdmin.StageChange(stage, null), "manager");
    }

    private void lose(UUID leadId) {
        var deal = deals.convert(leadId, new DealAdmin.Conversion(null, "sales", null,
                null, "manager"), "manager");
        deals.moveTo(deal.id(), new DealAdmin.StageChange("lost", "Выбрали другого поставщика"),
                "manager");
    }
}
