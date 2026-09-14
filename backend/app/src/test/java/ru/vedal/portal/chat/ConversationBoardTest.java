package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.*;

class ConversationBoardTest extends ChatTestBase {
    @Autowired ConversationBoard board;
    @Autowired ConversationRepository conversations;
    @Autowired ChatPrivacy privacy;
    @Autowired JdbcTemplate jdbc;

    @Test void projectsMeaningfulMessagesAndKeepsManualCorrections() {
        var key = visitor();
        var id = desk.say(key, "Срочно подберите оборудование для операционной", FROM_SITE).id();
        conversations.flush();
        var row = board.list("selection", null, "urgent", 0, 20).items().getFirst();
        assertThat(row.id()).isEqualTo(id);
        assertThat(row.summary()).contains("операционной");
        assertThat(row.nextAction()).contains("Подобрать");
        var edited = board.update(id, new ConversationBoard.Edit("Комплектация согласована", "ready_for_quote",
                "manager", "high", "Подготовить КП", true, row.version()), "editor");
        desk.say(key, "Добавьте монитор в комплектацию", FROM_SITE);
        assertThat(conversations.findById(id).orElseThrow().getSummary()).isEqualTo("Комплектация согласована");
        assertThat(board.list("ready_for_quote", "manager", "high", 0, 20).total()).isEqualTo(1);
        assertThat(board.list(null, "-", null, 0, 20).items()).noneMatch(r -> r.id().equals(id));
        assertThat(edited.manual()).isTrue();
        assertThat(jdbc.queryForObject("select count(*) from audit_entry where action = 'chat.board.edited'", Long.class)).isPositive();
    }

    @Test void ignoresSmallTalkAndAssistantTextAndCanResumeAutomaticProjection() {
        var key = visitor();
        var id = desk.say(key, "Подберите оборудование для клиники", FROM_SITE).id();
        desk.say(key, "спасибо большое", FROM_SITE);
        conversations.flush();
        var c = conversations.findById(id).orElseThrow();
        assertThat(c.getSummary()).contains("оборудование");
        assertThat(ConversationBoard.project(c, ChatMessage.ASSISTANT, "Срочно отправьте КП клиенту")).isFalse();
        var row = board.update(id, new ConversationBoard.Edit("Ручное резюме", "ready_for_quote", null,
                "normal", "Отправить КП", true, c.getVersion()), "editor");
        var reset = board.update(id, new ConversationBoard.Edit(row.summary(), row.stage(), row.owner(),
                row.importance(), row.nextAction(), false, row.version()), "editor");
        assertThat(reset.stage()).isEqualTo("selection");
        assertThat(reset.summary()).contains("оборудование");
        assertThat(reset.manual()).isFalse();
    }

    @Test void staleEditsConflictAndErasureRemovesDerivedText() {
        var id = desk.say(visitor(), "Подберите оборудование для клиники", FROM_SITE).id();
        conversations.flush();
        var c = conversations.findById(id).orElseThrow();
        assertThatThrownBy(() -> board.update(id, new ConversationBoard.Edit("Резюме", "new", null,
                "normal", "Позвонить", true, c.getVersion() + 1), "editor"))
                .isInstanceOf(ObjectOptimisticLockingFailureException.class);
        privacy.erase(id, "request", "editor");
        assertThat(c.getSummary()).isEqualTo(ChatPrivacy.ERASED);
        assertThat(c.getNextAction()).isEqualTo(ChatPrivacy.ERASED);
        assertThat(board.list(null, null, null, 0, 20).items()).noneMatch(row -> row.id().equals(id));
    }

    @Test void transportHandoffAndCloseUpdateAutomaticStage() {
        var id = desk.say(visitor(), "Подберите оборудование для клиники", FROM_SITE).id();
        desk.reply(id, "manager", "Помогу с подбором");
        assertThat(conversations.findById(id).orElseThrow().getStage()).isEqualTo("handed_to_human");
        desk.close(id, "manager");
        assertThat(conversations.findById(id).orElseThrow().getStage()).isEqualTo("closed");
    }
}
