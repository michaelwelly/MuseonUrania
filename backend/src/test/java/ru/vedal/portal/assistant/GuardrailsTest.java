package ru.vedal.portal.assistant;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

// Юнит-тест без контекста: правила — чистая функция, и проверять их надо
// в самом дешёвом тесте, чтобы он гонялся всегда.
class GuardrailsTest {

    private final Guardrails guardrails = new Guardrails();

    // Правила не срабатывали вообще: в Pattern.compile стоял флаг (?iu), где
    // строчная u — это UNICODE_CASE. Границу слова \b определяет
    // UNICODE_CHARACTER_CLASS, то есть (?U), и без неё \b вокруг кириллицы
    // не находится. Ассистент отвечал каталогом на вопрос про диагноз.
    @ParameterizedTest
    @ValueSource(strings = {
            "какой диагноз ставить при гипоксии",
            "чем лечить новорождённого",
            "как лечить гипотермию",
            "подскажите дозировку",
            "какие противопоказания",
            "есть ли симптомы у пациента",
    })
    void clinicalQuestionsAreRefused(String question) {
        assertThat(guardrails.refuse(question))
                .as("клинический вопрос: %s", question)
                .isPresent()
                .get().asString().contains("не даю медицинских заключений");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "сколько стоит VEDAL R1",
            "какая цена на инкубатор",
            "пришлите прайс",
            "есть скидки",
            "какая стоимость обслуживания",
    })
    void priceQuestionsAreRefused(String question) {
        assertThat(guardrails.refuse(question))
                .as("вопрос про цену: %s", question)
                .isPresent()
                .get().asString().contains("Цены не публикуются");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "какие сроки поставки",
            "когда привезёте",
            "есть в наличии инкубатор",
    })
    void deliveryQuestionsAreRefused(String question) {
        assertThat(guardrails.refuse(question))
                .as("вопрос про сроки: %s", question)
                .isPresent()
                .get().asString().contains("не выдумываю");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "нужен инкубатор для новорождённых",
            "где регистрационное удостоверение на A-2000",
            "какие изделия есть для реанимации",
            "как оставить сервисный запрос",
    })
    void legitimateQuestionsPass(String question) {
        assertThat(guardrails.refuse(question))
                .as("обычный вопрос: %s", question)
                .isEmpty();
    }

    @Test
    void emptyQuestionAsksToRephrase() {
        assertThat(guardrails.refuse("  ")).isPresent();
        assertThat(guardrails.refuse(null)).isPresent();
    }
}
