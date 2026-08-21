package ru.vedal.portal.assistant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.PostgresTestBase;

import static org.assertj.core.api.Assertions.assertThat;

// Что поиск считает подходящим материалом.
//
// Замер на живом стенде: вопрос «What is VEDAL A-2000? Do you have it in stock
// and what is the price?» приводил четыре источника, среди них VEDAL R1 —
// изделие, не имеющее к вопросу отношения. Попало оно единственным словом,
// которое есть у всех: маркой.
//
// Такую ошибку не видно ни тесту «ответ пришёл», ни глазу, если не знать
// каталог наизусть: список выглядит осмысленно, просто отвечает не на то.
class SearchNoiseTest extends PostgresTestBase {

    @Autowired
    LlmEngine engine;

    @Test
    void theBrandIsNotAMatchBecauseEveryProductCarriesIt() {
        var found = engine.answer("Расскажите про VEDAL A-2000",
                LlmEngine.Scope.PUBLIC).orElseThrow();

        // Спросили про одно изделие — второе в ответе появиться не должно.
        assertThat(found.sources())
                .as("Марка стоит в каждом названии и совпадением быть не может")
                .noneMatch(s -> s.title().contains("R1") || s.title().contains("R2"));

        assertThat(found.sources()).anyMatch(s -> s.title().contains("A-2000"));
    }

    @Test
    void aQuestionMadeOfNothingButTheBrandFindsNothing() {
        // Остаётся ноль значащих слов. Это не «ничего не нашли по каталогу»,
        // а «спросить было не о чем», и исход тот же: передача человеку.
        assertThat(engine.answer("VEDAL", LlmEngine.Scope.PUBLIC)).isEmpty();
        assertThat(engine.answer("ведал", LlmEngine.Scope.PUBLIC)).isEmpty();
    }

    @Test
    void aSingleWordFromADescriptionIsNotEnough() {
        // Слово, случайно попавшее в описание, не делает изделие подходящим.
        // До порога хватало одного совпадения где угодно — и на вопрос
        // не по теме приходил список каталога.
        assertThat(engine.answer("Есть ли у вас доставка транспортной компанией?",
                LlmEngine.Scope.PUBLIC))
                .as("Ни одного совпадения по названию — материалов нет, идёт передача человеку")
                .isEmpty();
    }

    @Test
    void aMatchInTheNameIsEnoughOnItsOwn() {
        // Порог не должен закрывать нормальный вопрос: совпадение по названию
        // весит больше описания и проходит его в одиночку.
        var found = engine.answer("инкубатор", LlmEngine.Scope.PUBLIC).orElseThrow();
        assertThat(found.sources()).isNotEmpty();
    }

    @Test
    void theQuestionOffTopicStillGetsNoAnswer() {
        assertThat(engine.answer("Какая завтра погода в Екатеринбурге?", LlmEngine.Scope.PUBLIC))
                .isEmpty();
    }

    // ————— обозначение модели —————
    //
    // Замерено на живом стенде: «R1», «R2», «VEDAL R1», «Т-100», «N15» —
    // ни одно изделие не находилось по собственному названию. Ассистент
    // отвечал «нет согласованных материалов» и звал человека, то есть хуже
    // всего отвечал ровно на то, что посетитель печатает чаще всего.
    //
    // Виноват был порог длины слова: обозначение короче четырёх знаков,
    // а после разбиения по дефису от «Т-100» остаются «т» и «100».

    @Test
    void aProductIsFoundByItsOwnModelName() {
        var r1 = engine.answer("R1", LlmEngine.Scope.PUBLIC).orElseThrow();
        assertThat(r1.sources()).anyMatch(s -> s.title().contains("R1"));

        var r2 = engine.answer("нужен R2", LlmEngine.Scope.PUBLIC).orElseThrow();
        assertThat(r2.sources()).anyMatch(s -> s.title().contains("R2"));
    }

    @Test
    void theModelNameSurvivesTheBrandBeingDropped() {
        // «VEDAL R1»: марка выброшена как совпадение, и всё, что остаётся, —
        // это «r1». Если и его съест порог, от вопроса не остаётся ничего.
        var found = engine.answer("VEDAL R1", LlmEngine.Scope.PUBLIC).orElseThrow();
        assertThat(found.sources()).anyMatch(s -> s.title().contains("R1"));
    }

    @Test
    void aModelNameSplitByAHyphenIsStillFound() {
        // «Т-100» распадается на «т» и «100». Первое — одна буква, второе —
        // три знака: под прежним порогом не проходило ни то, ни другое.
        //
        // Тут же вторая ловушка: «Т» в названии этого изделия кириллическая,
        // а посетитель наберёт латинскую. Обе формы обязаны находить, и находят
        // они по цифрам — буква в совпадении не участвует вовсе.
        assertThat(engine.answer("Т-100", LlmEngine.Scope.PUBLIC).orElseThrow().sources())
                .anyMatch(s -> s.title().contains("100"));
        assertThat(engine.answer("T-100", LlmEngine.Scope.PUBLIC).orElseThrow().sources())
                .anyMatch(s -> s.title().contains("100"));
    }

    @Test
    void aLoneDigitIsNotAModelName() {
        // «нужно 2 инкубатора»: одинокая «2» совпала бы с «2000» в названии
        // A-2000 — сравнение идёт по началу слова. Изделие в ответе появиться
        // должно, но по слову «инкубатор», а не по количеству.
        var found = engine.answer("нужно 2 штуки", LlmEngine.Scope.PUBLIC);
        assertThat(found).as("Количество — не обозначение модели").isEmpty();
    }

    // Правило проекта: ответ обязан нести ссылки. Утверждение без ссылки
    // проверить нечем, и порог не должен превратить ответ в текст без источников.
    @Test
    void everyAnswerCarriesTheSourcesItStandsOn() {
        var found = engine.answer("Система реанимационная для новорождённых",
                LlmEngine.Scope.PUBLIC).orElseThrow();

        assertThat(found.sources()).isNotEmpty();
        assertThat(found.text()).isNotBlank();
        found.sources().forEach(s -> assertThat(s.url()).isNotBlank());
    }
}
