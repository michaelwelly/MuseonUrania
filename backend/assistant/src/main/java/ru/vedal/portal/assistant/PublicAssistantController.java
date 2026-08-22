package ru.vedal.portal.assistant;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.vedal.portal.common.RateLimit;
import ru.vedal.portal.common.TooManyRequestsException;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/assistant/v1")
@Tag(name = "Ассистент")
public class PublicAssistantController {

    private final AssistantService assistant;
    private final RateLimit rateLimit;

    public PublicAssistantController(AssistantService assistant,
                                     @Qualifier("assistantRateLimit") RateLimit rateLimit) {
        this.assistant = assistant;
        this.rateLimit = rateLimit;
    }

    @Operation(summary = "Кнопки быстрых ответов",
            description = """
                    Подписи кнопок виджета и то, что делает каждая. Список приходит
                    отсюда, а не переписан в интерфейс: подпись и заготовка,
                    разложенные по двум местам, расходятся на первой же правке —
                    и расходятся молча.

                    Кнопка с `action: ask` отправляется в чат как сообщение
                    с полем `intent`, и на неё приходит заготовка. Кнопка
                    с `action: handoff` зовёт специалиста отдельной дверью —
                    `POST /chat/{visitorKey}/handoff`.

                    Без лимита частоты: ответ не зависит от запроса и кэшируется
                    на час, как остальные справочники портала.
                    """)
    @ApiResponse(responseCode = "200", description = "Кнопки по порядку.")
    @GetMapping("/prompts")
    public ResponseEntity<List<ScriptedReplies.Prompt>> prompts() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .body(ScriptedReplies.prompts());
    }

    @Operation(summary = "Спросить Ведалину",
            description = """
                    Отвечает только по опубликованным материалам портала: каталогу, ленте
                    и перечню документов. Закрытого файла в ответе не будет, потому что
                    его нет в контексте — движок ходит через интерфейсы модулей, а они
                    отдают исключительно опубликованное.

                    Вопросы про диагноз и цену отклоняются ограничениями до поиска.
                    Подходящих источников не нашлось — ответа нет, приходит `handoff`
                    с контактами и подходящими формами. Ответ всегда `200`: передача
                    человеку это штатный исход, а не ошибка.

                    Лимит частоты — 20 вопросов за 10 минут с адреса.
                    """)
    @ApiResponse(responseCode = "200",
            description = "Ответ со ссылками на источники либо передача человеку.")
    @ApiResponse(responseCode = "400", description = "Вопрос пуст или длиннее 500 символов.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @ApiResponse(responseCode = "429", description = "Превышен лимит частоты.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @PostMapping("/ask")
    public ResponseEntity<AskReply> ask(@Valid @RequestBody AskRequest request,
                                        HttpServletRequest http) {
        if (!rateLimit.allow(http.getRemoteAddr())) {
            throw new TooManyRequestsException("Слишком много вопросов подряд. Попробуйте позже.");
        }
        return ResponseEntity.ok(assistant.ask(request.question(), LlmEngine.Scope.PUBLIC, "public"));
    }
}
