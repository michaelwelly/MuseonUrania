package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.PostgresTestBase;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

// Разговор со стороны посетителя.
class ChatDeskTest extends PostgresTestBase {

    @Autowired
    ChatDesk desk;

    private static final ChatDesk.Context FROM_SITE =
            new ChatDesk.Context("ru", null, "/products/");

    private static String visitor() {
        return UUID.randomUUID().toString();
    }

    @Test
    void firstMessageStartsConversationAndGetsAnAnswer() {
        var thread = desk.say(visitor(), "Что такое VEDAL A-2000?", FROM_SITE);

        assertThat(thread.id()).isNotNull();
        assertThat(thread.messages()).hasSize(2);
        assertThat(thread.messages().get(0).author()).isEqualTo(ChatMessage.VISITOR);
        assertThat(thread.messages().get(1).author()).isEqualTo(ChatMessage.ASSISTANT);
    }

    // Ответ обязан нести источники: правило проекта — утверждение без ссылки
    // проверить нечем. В базе они лежат снимком, и лента обязана их вернуть,
    // иначе виджет покажет ответ, которому нельзя верить.
    @Test
    void answerCarriesItsSourcesBackFromTheThread() {
        var key = visitor();
        desk.say(key, "Что такое VEDAL A-2000?", FROM_SITE);

        var reread = desk.threadFor(key);
        var answer = reread.messages().get(1);

        assertThat(answer.author()).isEqualTo(ChatMessage.ASSISTANT);
        assertThat(answer.sources())
                .as("Ответ Урании без источников — ответ, которому нельзя верить")
                .isNotEmpty();
        assertThat(answer.sources().getFirst().url()).isNotBlank();
    }

    // У посетителя и у сотрудника источников нет и быть не может: их несёт
    // только ответ движка. Пустой список, а не null — иначе клиент обязан
    // помнить про два способа сказать «ничего».
    @Test
    void visitorLinesCarryNoSources() {
        var thread = desk.say(visitor(), "Что такое VEDAL A-2000?", FROM_SITE);

        assertThat(thread.messages().get(0).sources()).isEmpty();
    }

    // Вопрос про цену отклоняется ограничениями до поиска — это правило проекта,
    // а не поведение движка. Разговор при этом не обрывается, а встаёт в очередь
    // к человеку: передача специалисту это штатный исход.
    @Test
    void questionWithoutAnAnswerPutsTheConversationInTheQueue() {
        var thread = desk.say(visitor(), "Сколько стоит инкубатор?", FROM_SITE);

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
        desk.say(key, "Сколько стоит инкубатор?", FROM_SITE);

        var thread = desk.say(key, "Хорошо, жду ответа", FROM_SITE);

        // Три сообщения, а не четыре: вопрос, отказ ассистента, второе сообщение
        // посетителя — и ничего в ответ на него.
        assertThat(thread.messages()).hasSize(3);
        assertThat(thread.messages().get(2).author()).isEqualTo(ChatMessage.VISITOR);
    }

    // Один открытый разговор на ключ: второй означал бы, что посетитель пишет
    // в одно окно, а сотрудник отвечает в другое.
    @Test
    void secondMessageContinuesTheSameConversation() {
        var key = visitor();
        var first = desk.say(key, "Что такое VEDAL A-2000?", FROM_SITE);
        var second = desk.say(key, "А VEDAL Т-100?", FROM_SITE);

        assertThat(second.id()).isEqualTo(first.id());
        assertThat(second.messages()).hasSizeGreaterThan(first.messages().size());
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
