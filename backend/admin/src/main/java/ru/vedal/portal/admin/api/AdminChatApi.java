package ru.vedal.portal.admin.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import ru.vedal.portal.common.PageView;
import ru.vedal.portal.chat.ChatDesk;
import ru.vedal.portal.chat.ChatStream;

import java.util.UUID;

// Разговоры со стороны сотрудника.
//
// Две выборки, а не одна с фильтром, и это разные вопросы. Очередь — «кому
// надо ответить прямо сейчас»: только ждущие, дольше ждущие первыми. Список —
// «что вообще происходит». Смешав их, получаем экран, где закрытые разговоры
// недельной давности стоят вперемешку с теми, кто ждёт ответа третью минуту.
@RestController
@RequestMapping("/api/admin/v1/chats")
@Tag(name = "Админка: чат")
@SecurityRequirement(name = "keycloak")
public class AdminChatApi {

    private final ChatDesk desk;
    private final ChatStream stream;

    public AdminChatApi(ChatDesk desk, ChatStream stream) {
        this.desk = desk;
        this.stream = stream;
    }

    @Schema(name = "ChatReply", description = "Ответ сотрудника.")
    public record Reply(@NotBlank @Size(max = 4000) String text) {}

    @Operation(summary = "Очередь: кто ждёт живого ответа",
            description = """
                    Разговоры в состоянии `waiting`, дольше ждущие первыми. Это и есть
                    работа: разговор попадает сюда, когда Ведалина не нашла ответа
                    и передала человеку.
                    """)
    @GetMapping("/queue")
    public PageView<ChatDesk.Card> queue(@RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "20") int size) {
        return desk.queue(page, size);
    }

    @Operation(summary = "Все разговоры", description = "Последние сверху.")
    @GetMapping
    public PageView<ChatDesk.Card> all(@RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "20") int size) {
        return desk.all(page, size);
    }

    @Operation(summary = "Лента разговора")
    @ApiResponse(responseCode = "404", description = "Разговора нет.")
    @GetMapping("/{id}")
    public ChatDesk.Thread thread(@PathVariable UUID id) {
        return desk.threadOf(id);
    }

    @Operation(summary = "Ответить посетителю",
            description = """
                    Ответ и есть взятие разговора: сотрудник становится ответственным,
                    состояние переходит в `attended`. Отдельной кнопки «взять» нет
                    намеренно — взятый, но не отвеченный разговор пропадает из очереди,
                    а посетитель ждёт ровно так же, как ждал.

                    С этого момента Ведалина в разговоре молчит.
                    """)
    @ApiResponse(responseCode = "404", description = "Разговора нет.")
    @PostMapping("/{id}/messages")
    public ChatDesk.Thread reply(@PathVariable UUID id, @Valid @RequestBody Reply body,
                                 Authentication authentication) {
        return desk.reply(id, Actor.of(authentication), body.text());
    }

    @Operation(summary = "Сотрудник набирает ответ",
            description = """
                    Показывает посетителю «отвечают…». Ничего не записывает: факт живёт
                    секунды. Уходит только тому посетителю, чей это разговор.

                    Нужно ровно для одного — чтобы человек не ушёл со страницы за те
                    полминуты, пока сотрудник формулирует. Молчание в чате читается
                    как «меня не слышат».
                    """)
    @ApiResponse(responseCode = "204", description = "Принято.")
    @PostMapping("/{id}/typing")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void typing(@PathVariable UUID id) {
        desk.typingTo(id);
    }

    @Operation(summary = "Закрыть разговор",
            description = "Посетитель, написав снова, заведёт новый.")
    @ApiResponse(responseCode = "404", description = "Разговора нет.")
    @PostMapping("/{id}/close")
    public void close(@PathVariable UUID id, Authentication authentication) {
        desk.close(id, Actor.of(authentication));
    }

    @Operation(summary = "Поток обновлений по всем разговорам",
            description = """
                    Поток событий (`text/event-stream`) для рабочего места: приходит
                    `changed` с идентификатором разговора, в котором что-то изменилось.
                    Ни текста, ни автора — их сотрудник забирает обычным запросом ленты,
                    который проходит проверку прав.

                    Нужен, чтобы очередь не приходилось перезагружать руками: разговор,
                    попавший в ожидание, должен появиться на экране сам.
                    """)
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return stream.watchAll();
    }
}
