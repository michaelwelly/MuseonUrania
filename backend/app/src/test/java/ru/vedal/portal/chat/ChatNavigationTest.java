package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;
import ru.vedal.portal.assistant.AskReply;
import ru.vedal.portal.assistant.LlmEngine;
import ru.vedal.portal.common.NotFoundException;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class ChatNavigationTest extends ChatTestBase {
    @Test
    void offersOnlySafeSourcesAndKeepsConversationAfterConfirmation() {
        var key = visitor();
        var thread = desk.say(key, "Покажите изделие", FROM_SITE);
        desk.answered(thread.id(), new AskReply("Страница изделия", List.of(
                new LlmEngine.Source("Изделие", "/products/vedal-a-2000/", "product"),
                new LlmEngine.Source("Документ", "/api/public/v1/documents/sheet/file", "document"),
                new LlmEngine.Source("Чужая ссылка", "//evil.example/", "page")), null));
        var before = desk.threadFor(key);
        var answer = before.messages().getLast();
        assertThat(answer.actions()).hasSize(2);
        assertThat(answer.actions()).allMatch(NavigationAction::confirmationRequired);
        assertThat(desk.confirmNavigation(key, answer.id(), "/products/vedal-a-2000/").type())
                .isEqualTo("navigate");
        var after = desk.threadFor(key);
        assertThat(after.id()).isEqualTo(before.id());
        assertThat(after.messages()).hasSameSizeAs(before.messages());
        assertThat(after.status()).isEqualTo(Conversation.OPEN);
        assertThatThrownBy(() -> desk.confirmNavigation(key, answer.id(), "/contacts/"))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> desk.confirmNavigation(visitor(), answer.id(), "/products/vedal-a-2000/"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void rejectsUnsafePaths() {
        for (var url : List.of("//evil.example", "https://evil.example", "javascript:alert(1)",
                "/products/../admin/", "/products/%2e%2e/admin", "/admin/", "/products/\\evil", "/products/?redirect=https://evil.example")) {
            assertThat(NavigationAction.safe(url)).as(url).isFalse();
        }
    }
}
