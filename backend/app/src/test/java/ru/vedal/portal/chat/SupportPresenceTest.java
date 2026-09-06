package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import ru.vedal.portal.assistant.AssistantService;
import ru.vedal.portal.audit.AuditLog;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * «На связи» — это факт, а не расписание.
 *
 * <p>Открытое рабочее место означает, что человек смотрит в экран прямо
 * сейчас. Надпись, выставленная по часам работы, — обещание, и в обеденный
 * перерыв или в отпуске она врёт ровно тому, кто на неё понадеялся.
 *
 * <p><b>Почему часть проверок идёт на своём экземпляре рассылки.</b>
 * Подписки живут в памяти и общие на весь контекст Spring: соседний тест,
 * открывший рабочее место, делает «сейчас никого нет» недостижимым
 * состоянием. Свой {@link ChatStream} — это то же состояние, только
 * известное; класс при этом проверяется настоящий, а не его подобие.
 */
class SupportPresenceTest extends ChatTestBase {

    @Autowired
    ChatStream stream;

    @Autowired
    ConversationRepository conversations;

    @Autowired
    ChatMessageRepository messages;

    @Autowired
    AssistantService assistant;

    @Autowired
    AuditLog audit;

    @Autowired
    ObjectMapper json;

    @Autowired
    ApplicationEventPublisher bus;

    @Autowired
    SupportHours hours;

    /** Разговор со своей рассылкой: состояние присутствия здесь известно. */
    private ChatDesk deskWith(ChatStream ownStream) {
        return new ChatDesk(conversations, messages, assistant, audit, json, bus,
                ownStream, hours);
    }

    @Test
    void nobodyIsOnlineUntilADeskIsOpen() {
        var ownStream = new ChatStream();
        assertThat(ownStream.staffOnline()).isFalse();

        ownStream.watchAll();
        assertThat(ownStream.staffOnline())
                .as("Открытое рабочее место и значит «человек на связи»")
                .isTrue();

        // Обратного перехода здесь нет намеренно. Снятие подписки объявляет
        // контейнер, а `complete()` у потока, который ни разу ничего
        // не отправлял, обработчики не зовёт: вне MVC это просто пометка.
        // Само снятие проверено там, где есть контейнер, —
        // ChatStreamLimitsTest.closingATabFreesItsSlot идёт через ту же
        // отписку, что и рабочие места.
    }

    // Лента несёт это посетителю: виджет открывают до первого сообщения,
    // и надпись в шапке нужна ему уже тогда.
    @Test
    void anEmptyThreadStillSaysWhetherPeopleAreAround() {
        var ownStream = new ChatStream();
        var quiet = deskWith(ownStream);

        var thread = quiet.threadFor(visitor());

        assertThat(thread.messages()).isEmpty();
        assertThat(thread.support().online()).isFalse();
        assertThat(thread.support().hours())
                .as("Никого нет — надо сказать, когда бывают, иначе это читается "
                        + "как «здесь никого не бывает»")
                .isNotBlank();

        var open = ownStream.watchAll();
        try {
            assertThat(quiet.threadFor(visitor()).support().online()).isTrue();
        } finally {
            open.complete();
        }
    }

    // Зовя человека в нерабочее время, Ведалина обязана сказать об этом.
    // «Ответ придёт в это же окно» в полночь человек прочтёт как «сейчас
    // ответят»: он закроет вкладку через десять минут и решит, что чат сломан.
    @Test
    void callingAHumanWhenNobodyIsAroundSaysWhenTheyAnswer() {
        var quiet = deskWith(new ChatStream());

        var thread = quiet.callHuman(visitor(), FROM_SITE);

        var said = thread.messages().getFirst().body();
        assertThat(said).contains("на связи никого нет");
        assertThat(said)
                .as("Часы работы называются, и берутся они из настроек портала")
                .contains(hours.description());
        assertThat(said)
                .as("Обращение — то, что переживёт закрытую вкладку")
                .contains("обращение");
    }

    // А когда человек на связи — прежний текст: он и был правдой.
    @Test
    void withSomeoneAroundTheOldWordingStands() {
        var ownStream = new ChatStream();
        var busy = deskWith(ownStream);
        var open = ownStream.watchAll();

        try {
            var thread = busy.callHuman(visitor(), FROM_SITE);

            assertThat(thread.messages().getFirst().body())
                    .contains("Зову специалиста VEDAL")
                    .doesNotContain("на связи никого нет");
        } finally {
            open.complete();
        }
    }

    // Настоящая рассылка портала отвечает на тот же вопрос — проверяем, что
    // лента спрашивает именно её, а не выдумывает состояние.
    @Test
    void theRealThreadAsksTheRealStream() {
        var open = stream.watchAll();
        try {
            assertThat(desk.threadFor(visitor()).support().online()).isTrue();
        } finally {
            open.complete();
        }
    }
}
