package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.audit.AuditEntryRepository;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * «Помог» и «не помог» под ответом Ведалины.
 *
 * <p>Зачем это вообще: журнал показывает, когда ассистент молчит, и не
 * показывает худшего — он ответил уверенно и не по делу. В журнале такой
 * ответ неотличим от хорошего: источники нашлись, передачи не было.
 * Отличает его только тот, кто спрашивал.
 */
class ChatRatingTest extends ChatTestBase {

    @Autowired
    AuditEntryRepository audit;

    @Autowired
    ChatMessageRepository messages;

    private ChatDesk.Line answerFor(String key) {
        return desk.threadFor(key).messages().stream()
                .filter(m -> ChatMessage.ASSISTANT.equals(m.author()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Ведалина не ответила — нечего оценивать"));
    }

    @Test
    void anAnswerCanBeMarkedUnhelpfulAndTheThreadRemembersIt() {
        var key = visitor();
        sayAndAnswer(key, "Что такое VEDAL A-2000?");
        var answer = answerFor(key);

        assertThat(answer.helpful())
                .as("Не оценивали — это не «не помог»: отличать обязательно, "
                        + "иначе доля плохих ответов считается по молчавшим")
                .isNull();

        desk.rate(key, answer.id(), false);

        assertThat(answerFor(key).helpful()).isFalse();
    }

    // Человек передумал — это его право, и первая реакция не ценнее второй.
    @Test
    void theRatingCanBeChanged() {
        var key = visitor();
        sayAndAnswer(key, "Что такое VEDAL A-2000?");
        var answer = answerFor(key);

        desk.rate(key, answer.id(), false);
        desk.rate(key, answer.id(), true);

        assertThat(answerFor(key).helpful()).isTrue();
    }

    // Главная проверка. Ключ вкладки — единственное, что закрывает переписку;
    // без проверки принадлежности оценка стала бы дверью, через которую
    // перебором узнают, существует ли чужое сообщение.
    @Test
    void someoneElsesMessageCannotBeRated() {
        var чужой = visitor();
        sayAndAnswer(чужой, "Что такое VEDAL A-2000?");
        var чужойОтвет = answerFor(чужой);

        var свой = visitor();
        sayAndAnswer(свой, "Что такое VEDAL A-2000?");

        assertThatThrownBy(() -> desk.rate(свой, чужойОтвет.id(), false))
                .hasMessageContaining("не найдено");

        assertThat(messages.findById(чужойОтвет.id()).orElseThrow().getHelpful())
                .as("Чужая оценка не должна была проставиться")
                .isNull();
    }

    // Несуществующее сообщение отвечает тем же отказом, что и чужое: иначе
    // разница в ответах сама по себе сообщала бы, какие идентификаторы есть.
    @Test
    void anUnknownMessageAnswersTheSameWay() {
        var key = visitor();
        sayAndAnswer(key, "Что такое VEDAL A-2000?");

        assertThatThrownBy(() -> desk.rate(key, UUID.randomUUID(), true))
                .hasMessageContaining("не найдено");
    }

    // Оценивают ответ машины. «Специалист не помог» — это не оценка ответа,
    // а жалоба на человека, и разбирать её кнопкой в чате нельзя.
    @Test
    void onlyVedalinasAnswersAreRated() {
        var key = visitor();
        sayAndAnswer(key, "Что такое VEDAL A-2000?");

        var мой = desk.threadFor(key).messages().stream()
                .filter(m -> ChatMessage.VISITOR.equals(m.author()))
                .findFirst()
                .orElseThrow();

        assertThatThrownBy(() -> desk.rate(key, мой.id(), true))
                .hasMessageContaining("только ответы Ведалины");
    }

    // В журнал уходит каждое нажатие: важно не последнее мнение, а то,
    // что ответ вызвал сомнение. Текста при этом в журнале нет — он
    // неизменяем, и персональным данным там не место.
    @Test
    void theJournalRecordsTheFactWithoutTheText() {
        var key = visitor();
        sayAndAnswer(key, "Что такое VEDAL A-2000?");
        desk.rate(key, answerFor(key).id(), false);

        var records = audit.findAll().stream()
                .filter(e -> "chat.rated".equals(e.getAction()))
                .toList();

        assertThat(records).isNotEmpty();
        assertThat(String.valueOf(records.getLast().getPayload())).contains("false");
        assertThat(String.valueOf(records.getLast().getPayload()))
                .as("Ни вопроса, ни ответа в журнале быть не должно")
                .doesNotContain("VEDAL A-2000");
    }
}
