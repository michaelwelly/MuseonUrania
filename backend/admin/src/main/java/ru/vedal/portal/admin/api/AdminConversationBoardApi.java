package ru.vedal.portal.admin.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import ru.vedal.portal.chat.ConversationBoard;
import ru.vedal.portal.common.PageView;
import ru.vedal.portal.notifications.ConversationDigest;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/v1/chats/board")
public class AdminConversationBoardApi {
    private final ConversationBoard board;
    private final ConversationDigest digest;

    public AdminConversationBoardApi(ConversationBoard board, ConversationDigest digest) {
        this.board = board;
        this.digest = digest;
    }

    @GetMapping
    public PageView<ConversationBoard.Row> list(@RequestParam(required = false) String stage,
            @RequestParam(required = false) String owner, @RequestParam(required = false) String importance,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return board.list(stage, owner, importance, page, size);
    }
    public record Edit(@NotBlank @Size(max = 600) String summary,
            @NotNull @Pattern(regexp = "new|clarification|selection|ready_for_quote|handed_to_human|closed") String stage,
            @Size(max = 200) String owner,
            @NotNull @Pattern(regexp = "normal|high|urgent") String importance,
            @NotBlank @Size(max = 600) String nextAction, boolean manual, @PositiveOrZero long version) {}

    @PostMapping("/{id}")
    public ConversationBoard.Row update(@PathVariable UUID id, @Valid @RequestBody Edit edit, Authentication auth) {
        return board.update(id, new ConversationBoard.Edit(edit.summary(), edit.stage(), edit.owner(),
                edit.importance(), edit.nextAction(), edit.manual(), edit.version()), Actor.of(auth));
    }

    public record DigestResult(LocalDate date, boolean queued) {}

    @PostMapping("/digest")
    public DigestResult digest() {
        var date = LocalDate.now(ZoneId.of("Europe/Moscow"));
        return new DigestResult(date, digest.queue(date));
    }
}
