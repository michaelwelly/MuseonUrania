package ru.vedal.portal.chat;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.vedal.portal.common.RateLimit;
import ru.vedal.portal.common.TooManyRequestsException;

// Разговор со стороны посетителя.
//
// Живёт под /api/assistant/v1 намеренно. В архитектуре правило: дверей три,
// четвёртая не заводится. Чат выглядит как запись снаружи, то есть как
// нарушение, — но POST /api/assistant/v1/ask уже принимает свободный текст
// от анонима и уже стоит под лимитом частоты. Разговор это та же дверь,
// у которой ответ перестал быть разовым и в которую может войти человек.
// Новых правил проверки периметра не появляется, и это главное.
@RestController
@RequestMapping("/api/assistant/v1/chat")
@Tag(name = "Ассистент")
public class PublicChatController {

    private final ChatDesk desk;
    private final RateLimit rateLimit;

    public PublicChatController(ChatDesk desk,
                                @Qualifier("assistantRateLimit") RateLimit rateLimit) {
        this.desk = desk;
        this.rateLimit = rateLimit;
    }

    @Schema(name = "ChatSay", description = "Сообщение посетителя.")
    public record Say(

            @Schema(description = """
                    Случайный ключ, который виджет заводит в браузере и хранит между
                    страницами. По нему находится разговор. О посетителе не сообщает
                    ничего: это идентификатор вкладки, а не человека.
                    """, example = "b1f0c2de-9a7e-4d21-8c33-0f2a5e6d7b48")
            @NotBlank @Size(max = 64) String visitorKey,

            @Schema(description = "Текст сообщения.") @NotBlank @Size(max = 1000) String text,

            @Schema(description = "Язык страницы, с которой пишут.", nullable = true)
            @Size(max = 8) String language,

            @Schema(description = "Метка кампании, с которой пришёл посетитель.", nullable = true)
            @Size(max = 128) String campaign,

            @Schema(description = "Страница, с которой открыт виджет.", nullable = true)
            @Size(max = 512) String page) {}

    @Operation(summary = "Написать в чат",
            description = """
                    Заводит разговор при первом сообщении и отвечает Уранией по тем же
                    правилам, что и `POST /ask`: только по опубликованному, без диагнозов
                    и цен, без ответа при отсутствии источников.

                    Когда ответа нет, разговор переходит в состояние `waiting` — ждёт
                    сотрудника. С этого момента Урания молчит: машина, отвечающая поверх
                    человека, выглядит как сотрудник, который не читает, что ему пишут.

                    Возвращается вся лента разговора, а не одно новое сообщение: дописывание
                    требует, чтобы клиент и сервер одинаково понимали, где кончилось прошлое
                    состояние, а при обрыве связи они понимают это по-разному.

                    Лимит частоты общий с `ask` — 20 обращений за 10 минут с адреса.
                    """)
    @ApiResponse(responseCode = "200", description = "Лента разговора вместе с ответом.")
    @ApiResponse(responseCode = "400", description = "Пустое сообщение или длиннее 1000 символов.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @ApiResponse(responseCode = "429", description = "Превышен лимит частоты.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @PostMapping
    public ChatDesk.Thread say(@Valid @RequestBody Say request, HttpServletRequest http) {
        if (!rateLimit.allow(http.getRemoteAddr())) {
            throw new TooManyRequestsException("Слишком много сообщений подряд. Попробуйте позже.");
        }
        return desk.say(request.visitorKey(), request.text(),
                new ChatDesk.Context(request.language(), request.campaign(), request.page()));
    }

    @Operation(summary = "Прочитать разговор",
            description = """
                    Лента по ключу браузера. Разговора нет — пустая лента, а не 404:
                    для виджета «ещё не писали» и «не нашли» это одно и то же состояние,
                    и различать их незачем.
                    """)
    @ApiResponse(responseCode = "200", description = "Лента разговора, возможно пустая.")
    @GetMapping("/{visitorKey}")
    public ChatDesk.Thread thread(@PathVariable @Size(max = 64) String visitorKey) {
        return desk.threadFor(visitorKey);
    }
}
