package ru.vedal.portal.crm;

import org.junit.jupiter.api.Test;
import ru.vedal.portal.common.ConflictException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Правила воронок. Без Spring: это чистое правило домена, и гонять ради него
// контекст с базой значит платить секунды за проверку трёх списков.
class PipelinesTest {

    @Test
    void threePipelinesInAStableOrder() {
        assertThat(Pipelines.all()).containsExactly("sales", "dealer", "service");
    }

    @Test
    void everyPipelineStartsAtNew() {
        assertThat(Pipelines.first("sales")).isEqualTo("new");
        assertThat(Pipelines.first("dealer")).isEqualTo("new");
        assertThat(Pipelines.first("service")).isEqualTo("new");
    }

    @Test
    void salesStagesAreOrderedAsTheFunnelGoes() {
        assertThat(Pipelines.stages("sales"))
                .containsExactly("new", "qualified", "quoted", "won", "lost");
    }

    // Стадия из чужой воронки — не опечатка редактора, а рассыпавшаяся
    // аналитика: «repair» в продажах не попадёт ни в выигранные, ни
    // в проигранные, и конверсия перестанет сходиться.
    @Test
    void stageFromAnotherPipelineIsRefusedWithTheAllowedList() {
        assertThatThrownBy(() -> Pipelines.check("sales", "repair"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("не из воронки")
                .hasMessageContaining("qualified");
    }

    @Test
    void unknownPipelineIsRefused() {
        assertThatThrownBy(() -> Pipelines.stages("marketing"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Неизвестная воронка");
    }

    // У каждой воронки свой успешный исход, и все три обязаны считаться
    // выигранными: иначе отчёт покажет, что дилерская воронка не закрыла
    // ни одной сделки за год.
    @Test
    void everyPipelineHasItsOwnWonStage() {
        assertThat(Pipelines.isWon("won")).as("продажи").isTrue();
        assertThat(Pipelines.isWon("active")).as("дилерская").isTrue();
        assertThat(Pipelines.isWon("closed")).as("сервисная").isTrue();
    }

    @Test
    void lostStagesAreLostInEveryPipeline() {
        assertThat(Pipelines.isLost("lost")).isTrue();
        assertThat(Pipelines.isLost("declined")).isTrue();
        assertThat(Pipelines.isLost("won")).isFalse();
    }

    @Test
    void openStagesAreNotClosed() {
        assertThat(Pipelines.isClosed("new")).isFalse();
        assertThat(Pipelines.isClosed("quoted")).isFalse();
        assertThat(Pipelines.isClosed("won")).isTrue();
        assertThat(Pipelines.isClosed("declined")).isTrue();
    }

    // Названия исходов не должны пересекаться между воронками: одно и то же
    // слово, означающее победу в одной и поражение в другой, развалило бы
    // сведение трёх воронок в один отчёт.
    @Test
    void wonAndLostStageNamesDoNotOverlap() {
        assertThat(Pipelines.wonStages()).doesNotContainAnyElementsOf(Pipelines.lostStages());
    }

    // Исходы каждой воронки называются по отдельности: это то, что уезжает
    // в справочник воронок и в карточку сделки, и по чему форма решает,
    // спрашивать ли причину проигрыша.
    @Test
    void everyPipelineNamesItsOwnOutcomes() {
        assertThat(Pipelines.wonStages("sales")).containsExactly("won");
        assertThat(Pipelines.lostStages("sales")).containsExactly("lost");
        assertThat(Pipelines.wonStages("dealer")).containsExactly("active");
        assertThat(Pipelines.lostStages("dealer")).containsExactly("declined");
        assertThat(Pipelines.wonStages("service")).containsExactly("closed");
        assertThat(Pipelines.lostStages("service")).containsExactly("declined");
    }

    // Чужой исход в списке — это стадия, которую форма предложит, а портал
    // и ограничение схемы тут же откажутся принять: «active» есть в дилерской
    // воронке и не значит ничего в продажах.
    @Test
    void outcomesOfAPipelineAreStagesOfThatPipeline() {
        for (var pipeline : Pipelines.all()) {
            assertThat(Pipelines.stages(pipeline)).as(pipeline)
                    .containsAll(Pipelines.wonStages(pipeline))
                    .containsAll(Pipelines.lostStages(pipeline));
        }
    }

    // Воронка без исхода — сделка, которую нельзя ни закрыть, ни проиграть:
    // она навсегда останется в отчёте открытой.
    @Test
    void everyPipelineCanBeBothWonAndLost() {
        for (var pipeline : Pipelines.all()) {
            assertThat(Pipelines.wonStages(pipeline)).as(pipeline).isNotEmpty();
            assertThat(Pipelines.lostStages(pipeline)).as(pipeline).isNotEmpty();
        }
    }

    @Test
    void outcomesOfAnUnknownPipelineAreRefused() {
        assertThatThrownBy(() -> Pipelines.lostStages("marketing"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Неизвестная воронка");
    }
}
