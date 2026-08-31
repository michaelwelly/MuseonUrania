package ru.vedal.portal.chat;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import ru.vedal.portal.common.RateLimit;
import ru.vedal.portal.common.TooManyRequestsException;

import java.util.UUID;

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

            @Schema(description = """
                    Нажатая кнопка быстрого ответа — из `GET /api/assistant/v1/prompts`.
                    Пусто — человек напечатал сам. На известное намерение приходит
                    заготовка, минуя поиск: подпись кнопки в поиске находила изделия
                    по случайным словам.
                    """, example = "quote", nullable = true)
            @Size(max = 32) String intent,

            @Schema(description = "Язык страницы, с которой пишут.", nullable = true)
            @Size(max = 8) String language,

            @Schema(description = "Метка кампании, с которой пришёл посетитель.", nullable = true)
            @Size(max = 128) String campaign,

            @Schema(description = "Страница, с которой открыт виджет.", nullable = true)
            @Size(max = 512) String page) {}

    @Operation(summary = "Написать в чат",
            description = """
                    Заводит разговор при первом сообщении и отвечает Ведалиной по тем же
                    правилам, что и `POST /ask`: только по опубликованному, без диагнозов
                    и цен, без ответа при отсутствии источников.

                    **Ответа в теле ответа нет.** Возвращается лента с одним лишь
                    сообщением посетителя и признаком `answering` — Ведалина взялась
                    считать. Ответ доезжает потоком: сначала событиями `draft` с кусками
                    текста, затем `changed`, по которому лента перечитывается целиком.

                    Так сделано ради модели: она считает секундами, и ответ в теле того же
                    запроса означал бы неподвижное окно у посетителя, срок ожидания
                    у Caddy и занятый поток обслуживания на каждый вопрос. Нажатая кнопка
                    быстрого ответа — исключение: её текст известен заранее и приходит
                    сразу.

                    Когда ответа нет, разговор переходит в состояние `waiting` — ждёт
                    сотрудника. С этого момента Ведалина молчит: машина, отвечающая поверх
                    человека, выглядит как сотрудник, который не читает, что ему пишут.

                    Возвращается вся лента разговора, а не одно новое сообщение: дописывание
                    требует, чтобы клиент и сервер одинаково понимали, где кончилось прошлое
                    состояние, а при обрыве связи они понимают это по-разному.

                    Лимит частоты общий с `ask` — 20 обращений за 10 минут с адреса.
                    """)
    @ApiResponse(responseCode = "200",
            description = "Лента разговора с вопросом посетителя; ответ придёт потоком.")
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
        return desk.say(request.visitorKey(), request.text(), request.intent(),
                new ChatDesk.Context(request.language(), request.campaign(), request.page()));
    }

    @Schema(name = "ChatCallHuman", description = "Просьба позвать специалиста.")
    public record CallHuman(
            @Schema(description = "Ключ разговора в браузере.")
            @NotBlank @Size(max = 64) String visitorKey,

            @Schema(description = "Язык страницы.", nullable = true)
            @Size(max = 8) String language,

            @Schema(description = "Метка кампании.", nullable = true)
            @Size(max = 128) String campaign,

            @Schema(description = "Страница, с которой позвали.", nullable = true)
            @Size(max = 512) String page) {}

    @Operation(summary = "Позвать специалиста",
            description = """
                    Переводит разговор в состояние `waiting` — он встаёт в очередь
                    рабочего места, и с этого момента Ведалина в нём молчит.

                    До этой двери попасть к человеку можно было единственным способом:
                    задать вопрос, на который Ведалина не найдёт ответа. Человека
                    получал тот, кому не повезло, а не тот, кто его попросил.

                    Повторный вызов ничего не меняет: разговор уже у человека,
                    второго сообщения и второй записи в журнале не будет.

                    Лимит частоты общий с `ask`.
                    """)
    @ApiResponse(responseCode = "200", description = "Лента разговора; статус — `waiting`.")
    @ApiResponse(responseCode = "429", description = "Превышен лимит частоты.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @PostMapping("/handoff")
    public ChatDesk.Thread handoff(@Valid @RequestBody CallHuman request, HttpServletRequest http) {
        if (!rateLimit.allow(http.getRemoteAddr())) {
            throw new TooManyRequestsException("Слишком много обращений подряд. Попробуйте позже.");
        }
        return desk.callHuman(request.visitorKey(),
                new ChatDesk.Context(request.language(), request.campaign(), request.page()));
    }

    @Schema(name = "ChatRating", description = "Оценка ответа Ведалины.")
    public record Rating(

            @Schema(description = "Ключ разговора в браузере.")
            @NotBlank @Size(max = 64) String visitorKey,

            @Schema(description = "Какое сообщение оценивают. Идентификатор берётся "
                    + "из ленты: порядковый номер съезжает от каждой новой реплики.",
                    format = "uuid", requiredMode = Schema.RequiredMode.REQUIRED)
            @NotNull UUID messageId,

            @Schema(description = "Помог ли ответ.", example = "false",
                    requiredMode = Schema.RequiredMode.REQUIRED)
            @NotNull Boolean helpful) {}

    @Operation(summary = "Оценить ответ Ведалины",
            description = """
                    «Помог» или «не помог» под ответом ассистента.

                    Зачем это порталу: журнал показывает, когда Ведалина молчит,
                    и не показывает худшего — она ответила уверенно и не по делу.
                    В журнале такой ответ неотличим от хорошего: источники нашлись,
                    передачи человеку не было. Отличает его только тот, кто спрашивал.

                    Оценивать можно **только ответы Ведалины и только в своём
                    разговоре**. Чужое сообщение даёт `404` — тот же ответ, что
                    и несуществующее: иначе дверь сообщала бы перебором, какие
                    идентификаторы существуют.

                    Оценку можно поменять: человек передумал — это его право.
                    В журнал уходит каждое изменение; важно не последнее нажатие,
                    а то, что ответ вызвал сомнение.

                    Лимит частоты общий с `ask`.
                    """)
    @ApiResponse(responseCode = "200", description = "Лента разговора с проставленной оценкой.")
    @ApiResponse(responseCode = "404", description = "Разговора нет, сообщение чужое "
            + "или это не ответ Ведалины.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @ApiResponse(responseCode = "429", description = "Превышен лимит частоты.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @PostMapping("/rating")
    public ChatDesk.Thread rate(@Valid @RequestBody Rating request, HttpServletRequest http) {
        if (!rateLimit.allow(http.getRemoteAddr())) {
            throw new TooManyRequestsException("Слишком много обращений подряд. Попробуйте позже.");
        }
        return desk.rate(request.visitorKey(), request.messageId(), request.helpful());
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

    @Operation(summary = "Посетитель набирает текст",
            description = """
                    Сообщает сотруднику, что человек печатает. Ничего не записывает
                    и ничего не возвращает: факт живёт секунды и интересен только тому,
                    кто смотрит в экран прямо сейчас.

                    Виджет шлёт это не на каждую букву, а раз в несколько секунд, пока
                    поле не пустое: на каждое нажатие получился бы поток запросов
                    ради надписи, которая и так не меняется.
                    """)
    @ApiResponse(responseCode = "204", description = "Принято.")
    @PostMapping("/{visitorKey}/typing")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void typing(@PathVariable @Size(max = 64) String visitorKey) {
        desk.typing(visitorKey);
    }

    @Operation(summary = "Поток обновлений разговора",
            description = """
                    Поток событий (`text/event-stream`). Три вида:

                    - `changed` — идентификатор разговора, и только он: ни текста,
                      ни автора. Текст забирается следующим запросом
                      `GET /chat/{visitorKey}`, который проходит обычную проверку.
                    - `typing` — противоположная сторона набирает текст;
                      `who` = `staff` или `assistant`.
                    - `draft` — кусок ещё не дописанного ответа Ведалины.

                    `changed` не несёт текста намеренно: положи мы тело сообщения
                    в событие, и рассылка стала бы вторым местом, где решается,
                    кому что видно.

                    `draft` — единственное исключение, и оно узкое. Черновик уходит
                    только подписчикам этого `visitorKey` — тому же человеку, который
                    через секунду прочитает этот текст в своей ленте; второго набора
                    прав не появляется. На рабочие места черновик не идёт вовсе.
                    Он не хранится, не считается сообщением и заменяется лентой,
                    как только ответ записан.

                    Разговора ещё нет — поток открывается и молчит: посетитель мог
                    открыть виджет до первого сообщения, и отказ здесь означал бы,
                    что виджету надо самому решать, когда подписываться.

                    Соединение живёт полчаса, после чего браузер переподключается сам.
                    """)
    @ApiResponse(responseCode = "200", description = "Поток событий.")
    @GetMapping(value = "/{visitorKey}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@PathVariable @Size(max = 64) String visitorKey) {
        return desk.watch(visitorKey);
    }
}
