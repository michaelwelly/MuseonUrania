package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.PostgresTestBase;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

// Отметка прочтения: дошёл ли ответ до собеседника.
//
// Ставится чтением ленты, а не отдельной кнопкой: кнопки «прочитано» не бывает,
// а отдельный запрос от клиента можно не отправить — на обрыве связи, на
// закрытии вкладки, просто потому что его забыли позвать.
class ChatReadReceiptsTest extends PostgresTestBase {

    @Autowired
    ChatDesk desk;

    private static final ChatDesk.Context FROM_SITE =
            new ChatDesk.Context("ru", null, "/products/");

    private static String visitor() {
        return UUID.randomUUID().toString();
    }

    private static ChatDesk.Line lastOf(ChatDesk.Thread thread, String author) {
        return thread.messages().reversed().stream()
                .filter(m -> author.equals(m.author()))
                .findFirst()
                .orElseThrow();
    }

    @Test
    void visitorMessageStaysUnreadUntilStaffOpensTheThread() {
        var key = visitor();
        var id = desk.say(key, "Сколько стоит инкубатор?", FROM_SITE).id();

        assertThat(lastOf(desk.threadFor(key), ChatMessage.VISITOR).readAt())
                .as("Никто ещё не открывал разговор — отметки быть не должно")
                .isNull();

        desk.threadOf(id);

        assertThat(lastOf(desk.threadFor(key), ChatMessage.VISITOR).readAt()).isNotNull();
    }

    @Test
    void staffReplyStaysUnreadUntilTheVisitorLooks() {
        var key = visitor();
        var id = desk.say(key, "Сколько стоит инкубатор?", FROM_SITE).id();
        desk.reply(id, "anna", "Здравствуйте, уточняю у инженера.");

        assertThat(lastOf(desk.threadOf(id), ChatMessage.STAFF).readAt())
                .as("Сотрудник не может прочитать сам себя")
                .isNull();

        desk.threadFor(key);

        assertThat(lastOf(desk.threadOf(id), ChatMessage.STAFF).readAt()).isNotNull();
    }

    // Ведалина отвечает от имени портала. Галочка на её реплике от того, что
    // сотрудник открыл разговор, означала бы, что портал прочитал сам себя.
    @Test
    void staffOpeningTheThreadDoesNotMarkTheAssistantsOwnAnswer() {
        var key = visitor();
        var id = desk.say(key, "Что такое VEDAL A-2000?", FROM_SITE).id();

        desk.threadOf(id);

        assertThat(lastOf(desk.threadOf(id), ChatMessage.ASSISTANT).readAt()).isNull();
    }

    // Ответ Ведалины адресован посетителю — значит он его и прочитывает.
    @Test
    void visitorReadingMarksTheAssistantsAnswer() {
        var key = visitor();
        desk.say(key, "Что такое VEDAL A-2000?", FROM_SITE);

        desk.threadFor(key);

        assertThat(lastOf(desk.threadFor(key), ChatMessage.ASSISTANT).readAt()).isNotNull();
    }

    // Время прочтения не переписывается при каждом открытии: «прочитано в 10:03»
    // не должно превращаться в «прочитано в 15:40» оттого, что сотрудник
    // вернулся к разговору посмотреть.
    @Test
    void readTimeIsRecordedOnceAndDoesNotDrift() {
        var key = visitor();
        var id = desk.say(key, "Сколько стоит инкубатор?", FROM_SITE).id();

        desk.threadOf(id);
        var first = lastOf(desk.threadOf(id), ChatMessage.VISITOR).readAt();
        desk.threadOf(id);

        assertThat(lastOf(desk.threadOf(id), ChatMessage.VISITOR).readAt()).isEqualTo(first);
    }
}
