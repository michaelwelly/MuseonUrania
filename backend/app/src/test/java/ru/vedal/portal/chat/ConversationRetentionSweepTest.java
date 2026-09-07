package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import ru.vedal.portal.PostgresTestBase;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

// Автоочистка разговоров по сроку хранения.
//
// Отдельный контекст: свойство vedal.privacy.retention.chat здесь задано,
// а в остальных тестах — нет (см. ChatPrivacyTest.retentionSweepDoesNotExist...),
// и это ровно то, что должно различать два состояния портала.
@TestPropertySource(properties = "vedal.privacy.retention.chat=P30D")
class ConversationRetentionSweepTest extends PostgresTestBase {

    @Autowired
    ConversationRetentionSweep sweep;

    @Autowired
    ChatDesk desk;

    @Autowired
    ConversationRepository conversations;

    private static final ChatDesk.Context FROM_SITE =
            new ChatDesk.Context("ru", "innoprom", "/products/");

    @Test
    void erasesConversationsOlderThanTheConfiguredTerm() {
        var old = startConversation();
        setStartedAt(old, Instant.now().minus(40, ChronoUnit.DAYS));

        sweep.sweep();

        var after = conversations.findById(old).orElseThrow();
        assertThat(after.getErasedAt()).isNotNull();
        assertThat(after.getErasureBasis()).isEqualTo("истёк срок хранения");
    }

    @Test
    void leavesFreshConversationsUntouched() {
        var fresh = startConversation();

        sweep.sweep();

        var after = conversations.findById(fresh).orElseThrow();
        assertThat(after.getErasedAt()).isNull();
    }

    // Пограничный случай, который проверять важнее прочих: срок отсчитывается
    // не от «сейчас», а от даты начала разговора, и разговор, начавшийся
    // за день до среза, срок ещё не выбрал.
    @Test
    void leavesConversationsWithinTheTermUntouched() {
        var recent = startConversation();
        setStartedAt(recent, Instant.now().minus(10, ChronoUnit.DAYS));

        sweep.sweep();

        assertThat(conversations.findById(recent).orElseThrow().getErasedAt()).isNull();
    }

    private UUID startConversation() {
        return desk.say(UUID.randomUUID().toString(), "Меня зовут Иванов.", FROM_SITE).id();
    }

    private void setStartedAt(UUID id, Instant at) {
        var conversation = conversations.findById(id).orElseThrow();
        conversation.setStartedAt(at);
        conversations.saveAndFlush(conversation);
    }
}
