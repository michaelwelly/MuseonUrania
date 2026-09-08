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

    // ————— чужой язык —————
    //
    // Замер на стенде 7 сентября: «Сколько стоит VEDAL A-2000?» получал ответ
    // про расчёт под комплектацию и приглашение запросить КП, а «How much does
    // the VEDAL A-2000 cost?» уходил мимо правил — до модели. Цену она не
    // выдумала, но человек так и не узнал, что цену считают под комплектацию
    // и что можно оставить запрос. И держалось это на промпте, то есть
    // на просьбе к модели, — ровно на том, от чего правила и вынесены отдельно.
    @ParameterizedTest
    @ValueSource(strings = {
            "How much does the VEDAL A-2000 cost?",
            "what is the price of an incubator",
            "send me your pricing",
            "any discount for two units?",
    })
    void priceQuestionsAreRefusedInEnglishToo(String question) {
        assertThat(guardrails.refuse(question))
                .as("цена по-английски: %s", question)
                .isPresent()
                .get().asString().contains("Prices are not published");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "what is the delivery time for R2",
            "do you have it in stock",
            "when can you ship the incubator",
    })
    void deliveryQuestionsAreRefusedInEnglishToo(String question) {
        assertThat(guardrails.refuse(question))
                .as("сроки по-английски: %s", question)
                .isPresent()
                .get().asString().contains("do not invent");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "what dosage should I use",
            "how to treat hypothermia in a newborn",
            "my baby is not breathing, what do I do",
    })
    void clinicalQuestionsAreRefusedInEnglishToo(String question) {
        assertThat(guardrails.refuse(question))
                .as("клиника по-английски: %s", question)
                .isPresent()
                .get().asString().contains("do not give medical conclusions");
    }

    // Китайский: пробелов между словами нет, и \b там не находит ничего —
    // поэтому иероглифы ищутся подстрокой.
    @Test
    void chineseQuestionsAreRefusedAndAnsweredInChinese() {
        assertThat(guardrails.refuse("VEDAL A-2000 价格是多少？"))
                .isPresent()
                .get().asString().contains("我们不公开价格");

        assertThat(guardrails.refuse("交货时间是多久？"))
                .isPresent()
                .get().asString().contains("交货时间");
    }

    // Язык определяется письменностью, а не словарём: латиница в русском
    // вопросе не должна переключать ответ на английский.
    @Test
    void aRussianQuestionWithLatinModelNameStaysRussian() {
        assertThat(guardrails.refuse("Сколько стоит VEDAL A-2000?"))
                .isPresent()
                .get().asString().contains("Цены не публикуются");
    }

    // Обычный английский вопрос про изделие правила не трогают: иначе
    // иностранный клиент не получит ответа ни на один вопрос.
    @ParameterizedTest
    @ValueSource(strings = {
            "what monitoring channels does the A-2000 have",
            "which products do you have for resuscitation",
            "where is the registration certificate",
    })
    void legitimateEnglishQuestionsPass(String question) {
        assertThat(guardrails.refuse(question))
                .as("обычный вопрос по-английски: %s", question)
                .isEmpty();
    }

    @Test
    void emptyQuestionAsksToRephrase() {
        assertThat(guardrails.refuse("  ")).isPresent();
        assertThat(guardrails.refuse(null)).isPresent();
    }

    // «Материалов нет» — самый частый ответ иностранному посетителю, и это
    // не случайность: материалы у нас русские, и по английскому вопросу
    // поиск не находит ничего. Значит именно этот текст обязан звучать
    // на языке вопроса чаще прочих.
    //
    // Поймано на прогоне сценария показа: «Do you have neonatal incubators?»
    // получал ответ по-русски. Язык определялся верно — текст стоял мимо
    // этой механики, одной русской строкой в сервисе.
    @Test
    void notFoundSpeaksTheLanguageOfTheQuestion() {
        assertThat(guardrails.notFound("Есть ли у вас инкубаторы?"))
                .as("русский вопрос")
                .contains("нет согласованных материалов");

        assertThat(guardrails.notFound("Do you have neonatal incubators?"))
                .as("английский вопрос")
                .contains("no approved materials")
                .doesNotContain("согласованных");

        assertThat(guardrails.notFound("你们有婴儿培养箱吗？"))
                .as("китайский вопрос")
                .contains("核准的资料")
                .doesNotContain("согласованных");
    }

    // Латиница внутри русского вопроса не делает его английским: спрашивают
    // по-русски, и отвечать надо по-русски. Кириллица решает первой.
    @Test
    void latinModelNameDoesNotSwitchTheLanguage() {
        assertThat(guardrails.notFound("Что скажете про VEDAL A-2000 и R1?"))
                .contains("нет согласованных материалов");
    }
}
