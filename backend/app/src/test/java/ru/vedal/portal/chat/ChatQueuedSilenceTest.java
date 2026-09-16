package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import ru.vedal.portal.assistant.AssistantService;
import ru.vedal.portal.audit.AuditLog;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Очередь, которую некому взять, — не повод молчать.
 *
 * <p><b>Что этот тест стережёт.</b> Правило «человек в разговоре — Ведалина
 * молкнет» остаётся главным, но у него есть граница. Разговор в WAITING,
 * которого никто не взял и брать сейчас некому, человеку не передан —
 * он в очередь положен. Перебивать там некого, а посетитель упирается
 * в тишину: ключ его вкладки лежит в браузере, и немота переживает
 * перезагрузку страницы. На боевой машине такой разговор молчал днями.
 *
 * <p><b>Почему на своём экземпляре рассылки.</b> Подписки живут в памяти
 * и общие на весь контекст Spring: соседний тест, открывший рабочее место,
 * делает «сейчас никого нет» недостижимым состоянием — и обратного перехода
 * у него нет, потому что снятие подписки объявляет контейнер. Свой
 * {@link ChatStream} — это то же состояние, только известное; классы при
 * этом проверяются настоящие, а не их подобие. Тем же приёмом пользуется
 * {@code SupportPresenceTest}.
 */
class ChatQueuedSilenceTest extends ChatTestBase {

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

    // Значения — те же, что действуют по умолчанию в проде (см. ChatStream).
    private static ChatStream ownStream() {
        return new ChatStream(Duration.ofMinutes(30), 4, 500, 64);
    }

    private ChatDesk deskWith(ChatStream ownStream) {
        return new ChatDesk(conversations, messages, assistant, audit, json, bus,
                ownStream, hours);
    }

    /**
     * Спросить и дождаться ответа на своём разговоре.
     *
     * <p>Второй шаг руками — как и в {@link ChatTestBase}: тест идёт
     * в транзакции, которая откатывается, до COMMIT дело не доходит,
     * а слушатель ответа ждёт именно COMMIT. Считает при этом настоящий
     * {@link Answering}, только собранный на этой же рассылке.
     */
    private void sayAndAnswerOn(ChatDesk ownDesk, ChatStream ownStream, String key, String text) {
        var accepted = ownDesk.say(key, text, FROM_SITE);
        new Answering(ownDesk, assistant, ownStream)
                .answer(new ChatDesk.Asked(accepted.id(), key, text));
    }

    // ————— никого нет на линии —————

    @Test
    void withNobodyAroundTheAssistantKeepsAnsweringAQueuedConversation() {
        var ownStream = ownStream();
        var quiet = deskWith(ownStream);
        var key = visitor();

        var queued = quiet.callHuman(key, FROM_SITE);
        assertThat(queued.status()).isEqualTo(Conversation.WAITING);

        sayAndAnswerOn(quiet, ownStream, key, "Что такое VEDAL A-2000?");
        var thread = quiet.threadFor(key);

        // Три сообщения: «зову специалиста», вопрос посетителя — и ответ
        // на него. До правки третьего не было, и посетитель ждал сутками.
        assertThat(thread.messages()).hasSize(3);
        assertThat(thread.messages().getLast().author())
                .as("Перебивать некого: за специалистом никто не пошёл")
                .isEqualTo(ChatMessage.ASSISTANT);
        assertThat(thread.messages().getLast().sources()).isNotEmpty();

        assertThat(thread.status())
                .as("Ведалина не отменяет передачу: разговор остаётся в очереди")
                .isEqualTo(Conversation.WAITING);
    }

    // ————— а вот теперь есть кому перебить —————

    @Test
    void withADeskOpenTheAssistantStaysQuiet() {
        var ownStream = ownStream();
        var busy = deskWith(ownStream);
        var open = ownStream.watchAll("editor");
        var key = visitor();

        try {
            busy.callHuman(key, FROM_SITE);

            sayAndAnswerOn(busy, ownStream, key, "Что такое VEDAL A-2000?");
            var thread = busy.threadFor(key);

            // Два сообщения: «зову специалиста» и вопрос посетителя. Дежурный
            // смотрит в очередь прямо сейчас — справка по каталогу поверх его
            // «сейчас уточню» выглядит как сотрудник, не читающий, что ему пишут.
            assertThat(thread.messages()).hasSize(2);
            assertThat(thread.messages().getLast().author()).isEqualTo(ChatMessage.VISITOR);
            assertThat(thread.status()).isEqualTo(Conversation.WAITING);
        } finally {
            open.complete();
        }
    }

    @Test
    void onceTheConversationIsTakenTheAssistantStaysQuietEvenWithNobodyAtADesk() {
        var ownStream = ownStream();
        var quiet = deskWith(ownStream);
        var key = visitor();

        var queued = quiet.callHuman(key, FROM_SITE);
        // Сотрудник ответил — разговор взят, у него появился владелец.
        quiet.reply(queued.id(), "editor", "Здравствуйте, сейчас уточню у инженера.");

        sayAndAnswerOn(quiet, ownStream, key, "Что такое VEDAL A-2000?");
        var thread = quiet.threadFor(key);

        // Три сообщения: «зову специалиста», реплика сотрудника, «хорошо, жду».
        // Четвёртого быть не должно — закрытая вкладка дежурного не означает,
        // что он ушёл, и говорить за него нельзя.
        assertThat(thread.messages()).hasSize(3);
        assertThat(thread.messages().getLast().author()).isEqualTo(ChatMessage.VISITOR);
        assertThat(thread.status()).isEqualTo(Conversation.ATTENDED);
    }

    // Отказ сторожевого правила разговор в очередь не ставит вовсе — значит
    // и граница выше к нему не применяется. Проверка здесь затем, что именно
    // связка «отказ ставит в очередь» + «в очереди молчим» и дала боевую
    // немоту: починена она в двух местах, а ломалась в одном.
    @Test
    void aPriceQuestionNeverReachesThatBorderAtAll() {
        var ownStream = ownStream();
        var quiet = deskWith(ownStream);
        var key = visitor();

        sayAndAnswerOn(quiet, ownStream, key, "Сколько стоит инкубатор A-2000 и какая скидка?");
        sayAndAnswerOn(quiet, ownStream, key, "Что такое VEDAL A-2000?");

        var thread = quiet.threadFor(key);
        assertThat(thread.status()).isEqualTo(Conversation.OPEN);
        assertThat(thread.messages()).hasSize(4);
        assertThat(thread.messages().get(1).body()).contains("Цены не публикуются");
        assertThat(thread.messages().get(3).author()).isEqualTo(ChatMessage.ASSISTANT);
    }
}
