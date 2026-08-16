package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.PostgresTestBase;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Сторона сотрудника: очередь, ответ, закрытие.
class ChatStaffTest extends PostgresTestBase {

    @Autowired
    ChatDesk desk;

    private static final ChatDesk.Context FROM_SITE =
            new ChatDesk.Context("ru", null, "/products/");

    private static String visitor() {
        return UUID.randomUUID().toString();
    }

    /** Вопрос про цену отклоняется ограничениями — разговор встаёт в очередь. */
    private UUID waitingConversation() {
        return desk.say(visitor(), "Сколько стоит инкубатор?", FROM_SITE).id();
    }

    @Test
    void queueHoldsOnlyThoseWaitingForAHuman() {
        var waiting = waitingConversation();
        // Разговор, на который ассистент ответил сам, работы человеку не создаёт
        // и в очереди ему не место.
        desk.say(visitor(), "Что такое VEDAL A-2000?", FROM_SITE);

        var queue = desk.queue(0, 50);

        assertThat(queue.getContent()).extracting(ChatDesk.Card::id).contains(waiting);
        assertThat(queue.getContent()).allMatch(c -> Conversation.WAITING.equals(c.status()));
    }

    // Ответ и есть взятие: отдельной кнопки «взять» нет намеренно. Взятый,
    // но не отвеченный разговор пропадает из очереди, а посетитель ждёт ровно
    // так же, как ждал.
    @Test
    void replyingTakesTheConversation() {
        var id = waitingConversation();

        var thread = desk.reply(id, "anna", "Здравствуйте, уточняю у инженера.");

        assertThat(thread.status()).isEqualTo(Conversation.ATTENDED);
        var last = thread.messages().getLast();
        assertThat(last.author()).isEqualTo(ChatMessage.STAFF);
        assertThat(last.actor()).isEqualTo("anna");

        assertThat(desk.queue(0, 50).getContent())
                .as("Отвеченный разговор обязан уйти из очереди")
                .extracting(ChatDesk.Card::id)
                .doesNotContain(id);
    }

    // Продолжение главного правила модуля, но уже через настоящий ответ
    // сотрудника, а не через передачу по отсутствию источников.
    @Test
    void assistantDoesNotAnswerOverAStaffMember() {
        var key = visitor();
        var id = desk.say(key, "Сколько стоит инкубатор?", FROM_SITE).id();
        desk.reply(id, "anna", "Здравствуйте, уточняю у инженера.");

        var thread = desk.say(key, "Хорошо, жду", FROM_SITE);

        assertThat(thread.messages().getLast().author()).isEqualTo(ChatMessage.VISITOR);
    }

    @Test
    void closedConversationLeavesTheQueueAndTheVisitorStartsANewOne() {
        var key = visitor();
        var id = desk.say(key, "Сколько стоит инкубатор?", FROM_SITE).id();

        desk.close(id, "anna");

        assertThat(desk.threadFor(key).id())
                .as("Закрытый разговор больше не находится по ключу браузера")
                .isNull();

        var second = desk.say(key, "Сколько стоит инкубатор?", FROM_SITE);
        assertThat(second.id()).isNotEqualTo(id);
    }

    @Test
    void unknownConversationIsRefusedRatherThanSilentlyCreated() {
        assertThatThrownBy(() -> desk.reply(UUID.randomUUID(), "anna", "Здравствуйте"))
                .hasMessageContaining("не найден");
    }
}
