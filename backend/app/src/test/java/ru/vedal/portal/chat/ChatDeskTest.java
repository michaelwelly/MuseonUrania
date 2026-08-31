package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

// Разговор со стороны посетителя.
class ChatDeskTest extends ChatTestBase {

    @Test
    void firstMessageStartsConversationAndGetsAnAnswer() {
        var key = visitor();
        sayAndAnswer(key, "Что такое VEDAL A-2000?");

        var thread = desk.threadFor(key);

        assertThat(thread.id()).isNotNull();
        assertThat(thread.messages()).hasSize(2);
        assertThat(thread.messages().get(0).author()).isEqualTo(ChatMessage.VISITOR);
        assertThat(thread.messages().get(1).author()).isEqualTo(ChatMessage.ASSISTANT);
    }

    // Дверь отвечает сразу, а ответ доезжает потом. Раньше движок вызывался
    // внутри того же запроса, и с моделью это означало бы окно, в котором
    // десять секунд не происходит ничего: точки рисовал сам виджет и гасил
    // их на первой же перезагрузке.
    @Test
    void questionIsAcceptedBeforeTheAnswerIsReady() {
        var accepted = desk.say(visitor(), "Что такое VEDAL A-2000?", FROM_SITE);

        assertThat(accepted.messages())
                .as("В теле ответа только вопрос: ответ считается отдельно")
                .hasSize(1);
        assertThat(accepted.messages().getFirst().author()).isEqualTo(ChatMessage.VISITOR);
    }

    // Ответ обязан нести источники: правило проекта — утверждение без ссылки
    // проверить нечем. В базе они лежат снимком, и лента обязана их вернуть,
    // иначе виджет покажет ответ, которому нельзя верить.
    @Test
    void answerCarriesItsSourcesBackFromTheThread() {
        var key = visitor();
        sayAndAnswer(key, "Что такое VEDAL A-2000?");

        var reread = desk.threadFor(key);
        var answer = reread.messages().get(1);

        assertThat(answer.author()).isEqualTo(ChatMessage.ASSISTANT);
        assertThat(answer.sources())
                .as("Ответ Ведалины без источников — ответ, которому нельзя верить")
                .isNotEmpty();
        assertThat(answer.sources().getFirst().url()).isNotBlank();
    }

    // У посетителя и у сотрудника источников нет и быть не может: их несёт
    // только ответ движка. Пустой список, а не null — иначе клиент обязан
    // помнить про два способа сказать «ничего».
    @Test
    void visitorLinesCarryNoSources() {
        var key = visitor();
        sayAndAnswer(key, "Что такое VEDAL A-2000?");

        assertThat(desk.threadFor(key).messages().get(0).sources()).isEmpty();
    }

    // Вопрос про цену отклоняется ограничениями до поиска — это правило проекта,
    // а не поведение движка. Разговор при этом не обрывается, а встаёт в очередь
    // к человеку: передача специалисту это штатный исход.
    @Test
    void questionWithoutAnAnswerPutsTheConversationInTheQueue() {
        var key = visitor();
        sayAndAnswer(key, "Сколько стоит инкубатор?");

        var thread = desk.threadFor(key);

        assertThat(thread.status()).isEqualTo(Conversation.WAITING);
        assertThat(thread.messages()).hasSize(2);
    }

    // Главное правило модуля. Как только разговор передан человеку, машина
    // замолкает совсем: иначе на «хорошо, жду» посетителя ассистент выдаёт
    // справку по каталогу, и со стороны это выглядит как сотрудник, который
    // не читает, что ему пишут.
    @Test
    void assistantStaysSilentOnceAHumanIsInvolved() {
        var key = visitor();
        sayAndAnswer(key, "Сколько стоит инкубатор?");

        sayAndAnswer(key, "Хорошо, жду ответа");
        var thread = desk.threadFor(key);

        // Три сообщения, а не четыре: вопрос, отказ ассистента, второе сообщение
        // посетителя — и ничего в ответ на него.
        assertThat(thread.messages()).hasSize(3);
        assertThat(thread.messages().get(2).author()).isEqualTo(ChatMessage.VISITOR);
    }

    // То же правило, но в щели между приёмом вопроса и готовым ответом.
    // Пока Ведалина считала, посетитель нажал «позвать специалиста» или
    // сотрудник взял разговор из очереди — и готовый ответ уже нельзя
    // записывать: он ляжет поверх реплики человека.
    @Test
    void answerIsDroppedIfAHumanSteppedInWhileItWasBeingComputed() {
        var key = visitor();
        var accepted = desk.say(key, "Что такое VEDAL A-2000?", FROM_SITE);

        // Человек вошёл в разговор до того, как ответ был записан.
        desk.callHuman(key, FROM_SITE);

        answering.answer(new ChatDesk.Asked(accepted.id(), key, "Что такое VEDAL A-2000?"));

        var thread = desk.threadFor(key);
        assertThat(thread.messages())
                .as("Ответ, поспевший после человека, в ленту не попадает")
                .extracting(ChatDesk.Line::author)
                .containsExactly(ChatMessage.VISITOR, ChatMessage.ASSISTANT);
        assertThat(thread.messages().getLast().body()).contains("специалиста");
    }

    // Один открытый разговор на ключ: второй означал бы, что посетитель пишет
    // в одно окно, а сотрудник отвечает в другое.
    @Test
    void secondMessageContinuesTheSameConversation() {
        var key = visitor();
        var first = sayAndAnswer(key, "Что такое VEDAL A-2000?");
        var afterFirst = desk.threadFor(key).messages().size();

        var second = sayAndAnswer(key, "А VEDAL Т-100?");

        assertThat(second.id()).isEqualTo(first.id());
        assertThat(desk.threadFor(key).messages()).hasSizeGreaterThan(afterFirst);
    }

    // Виджет перечитывает ленту на каждой загрузке страницы: разговора нет —
    // это пустая лента, а не отказ. Для виджета «ещё не писали» и «не нашли» —
    // одно состояние.
    @Test
    void unknownVisitorGetsAnEmptyThreadRatherThanAnError() {
        var thread = desk.threadFor(visitor());

        assertThat(thread.id()).isNull();
        assertThat(thread.messages()).isEmpty();
    }
}
