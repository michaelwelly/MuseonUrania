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

    // Речь человека, описывающего состояние ребёнка, а не лексика врача.
    //
    // Замер на стенде: «У новорождённого температура 35 градусов, что делать?»
    // проходил мимо правил, поиск находил в каталоге слово «температура»
    // и ассистент отвечал подбором инкубатора. Родителю переохлаждённого
    // младенца предлагалось изделие.
    @ParameterizedTest
    @ValueSource(strings = {
            "У новорождённого температура 35 градусов, что делать?",
            "у ребёнка температура 39, поможете",
            "у младенца пульс упал",
            "у пациента давление низкое",
            "Ребёнок не дышит, что делать?",
            "у младенца судороги",
            "новорождённый посинел и не реагирует",
            "ребёнок задыхается",
            "как реанимировать младенца",
    })
    void clinicalSituationsAreRefused(String question) {
        assertThat(guardrails.refuse(question))
                .as("описание состояния человека: %s", question)
                .isPresent()
                .get().asString().contains("не даю медицинских заключений");
    }

    // Обратная сторона того же правила. Признаки порознь ничего не значат:
    // «температура» стоит в описании каждого инкубатора, «новорождённый» —
    // в названии половины каталога. Заблокируй их по отдельности — и каталог
    // перестанет отвечать на вопросы, ради которых он написан.
    @ParameterizedTest
    @ValueSource(strings = {
            "какая точность поддержания температуры у A-2000",
            "инкубатор для новорождённых с подогревом",
            "какая температура в инкубаторе VEDAL",
            "нужна система терморегуляции для отделения новорождённых",
            "какой вес выдерживает матрасик",
            "нужен сервис для VEDAL R2, что делать",
    })
    void productQuestionsAboutTemperatureStillPass(String question) {
        assertThat(guardrails.refuse(question))
                .as("вопрос про изделие: %s", question)
                .isEmpty();
    }

    @Test
    void emptyQuestionAsksToRephrase() {
        assertThat(guardrails.refuse("  ")).isPresent();
        assertThat(guardrails.refuse(null)).isPresent();
    }
}
