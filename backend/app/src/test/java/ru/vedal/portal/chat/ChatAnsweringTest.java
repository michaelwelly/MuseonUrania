package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

// Ожидание ответа: что видит посетитель между вопросом и ответом.
//
// Раньше между ними ничего не было — движок отвечал внутри того же запроса.
// С моделью там появляются секунды, и они принадлежат человеку, который
// смотрит в окно: он должен видеть, что его вопрос приняли и над ним работают.
class ChatAnsweringTest extends ChatTestBase {

    @Autowired
    ChatStream stream;

    // Точки в окне рисует не виджет по своему усмотрению, а портал по факту.
    // Разница видна на перезагрузке страницы: своё состояние виджет теряет,
    // а это — спрашивает и получает.
    @Test
    void theThreadSaysWhenVedalinaIsStillThinking() {
        var key = visitor();
        var accepted = desk.say(key, "Что такое VEDAL A-2000?", FROM_SITE);

        // То, что делает слушатель после COMMIT. В тесте до COMMIT дело
        // не доходит: транзакция откатывается.
        stream.startedAnswering(accepted.id(), key);

        assertThat(desk.threadFor(key).answering())
                .as("Виджет, открытый посреди ожидания, обязан снова показать точки")
                .isTrue();

        stream.finishedAnswering(accepted.id());

        assertThat(desk.threadFor(key).answering()).isFalse();
    }

    // Ответ дописан — раздумье кончилось. Флаг, оставшийся включённым, это
    // вечные точки у человека, которому уже ответили.
    @Test
    void thinkingStopsWhenTheAnswerIsWritten() {
        var key = visitor();
        var accepted = desk.say(key, "Что такое VEDAL A-2000?", FROM_SITE);
        stream.startedAnswering(accepted.id(), key);

        answering.answer(new ChatDesk.Asked(accepted.id(), key, "Что такое VEDAL A-2000?"));

        assertThat(desk.threadFor(key).answering()).isFalse();
        assertThat(desk.threadFor(key).messages().getLast().author())
                .isEqualTo(ChatMessage.ASSISTANT);
    }

    // Движок упал, очередь переполнена, модель недоступна — исход один:
    // разговор уходит человеку. Молчание здесь означало бы посетителя,
    // который ждёт ответа, а его никто не готовит.
    @Test
    void aFailedAnswerHandsTheConversationToAHumanRatherThanGoingSilent() {
        var key = visitor();
        var accepted = desk.say(key, "Что такое VEDAL A-2000?", FROM_SITE);
        stream.startedAnswering(accepted.id(), key);

        desk.answerFailed(accepted.id());

        var thread = desk.threadFor(key);
        assertThat(thread.status())
                .as("Не сложившийся ответ — повод позвать человека, а не промолчать")
                .isEqualTo(Conversation.WAITING);
        assertThat(thread.messages().getLast().author()).isEqualTo(ChatMessage.ASSISTANT);
        assertThat(thread.messages().getLast().body()).containsIgnoringCase("специалист");
    }

    // Разговора нет — раздумья тоже нет. Пустая лента не должна показывать
    // точки: посетителю ещё не на что отвечать.
    @Test
    void anEmptyThreadIsNotThinking() {
        assertThat(desk.threadFor(visitor()).answering()).isFalse();
        assertThat(stream.answering(null)).isFalse();
        assertThat(stream.answering(UUID.randomUUID())).isFalse();
    }
}
