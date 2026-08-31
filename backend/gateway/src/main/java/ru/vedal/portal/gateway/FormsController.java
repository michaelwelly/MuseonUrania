package ru.vedal.portal.gateway;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.vedal.portal.common.RateLimit;
import ru.vedal.portal.common.TooManyRequestsException;
import ru.vedal.portal.chat.ChatDesk;
import ru.vedal.portal.crm.LeadIntake;

import java.util.UUID;

// Единственная дверь на запись снаружи. Авторизации нет — дверь публичная
// по назначению, поэтому проверки здесь и есть весь периметр.
@RestController
@RequestMapping("/api/forms/v1")
@Tag(name = "Формы")
public class FormsController {

    // Текст из docs/frontend/content_model.md → Lead Form Model.
    private static final String SUCCESS = "Спасибо. Специалист VEDAL свяжется с вами.";

    @Schema(name = "LeadAccepted", description = "Расписка о принятой заявке.")
    public record Accepted(

            @Schema(description = "Идентификатор заявки. Повтор с тем же `Idempotency-Key` "
                    + "вернёт этот же идентификатор.",
                    format = "uuid", example = "3f2a7c18-9d41-4a6b-8f0e-2b9c5d7e1a34")
            UUID id,

            @Schema(description = """
                    Номер заявки для людей. Его называют по телефону и пишут в письме;
                    идентификатор для этого не годится. Повтор с тем же `Idempotency-Key`
                    вернёт этот же номер: второй номер на одну заявку — это два обращения
                    в глазах того, кто их называет.
                    """, example = "З-2026-0042")
            String number,

            @Schema(description = "Текст для показа посетителю.",
                    example = "Спасибо. Специалист VEDAL свяжется с вами.")
            String message) {}

    private final LeadIntake intake;
    private final ChatDesk chat;
    private final RateLimit rateLimit;

    public FormsController(LeadIntake intake, ChatDesk chat,
                           @Qualifier("formsRateLimit") RateLimit rateLimit) {
        this.intake = intake;
        this.chat = chat;
        this.rateLimit = rateLimit;
    }

    @Operation(summary = "Отправить заявку",
            description = """
                    Принимает заявку с любой из пяти форм сайта.

                    Отвечает `202 Accepted`, а не `201`: заявка принята и поставлена
                    в разбор менеджеру, готового ресурса за ней не стоит.

                    Периметр этой двери — валидация полей, скрытая ловушка для ботов
                    и лимит частоты по адресу клиента: 5 обращений за 10 минут.
                    """)
    @ApiResponse(responseCode = "202", description = "Заявка принята.")
    @ApiResponse(responseCode = "400",
            description = "Поля не прошли проверку — разбор в расширении `fields`; либо заявка "
                    + "отклонена по заполненной ловушке.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @ApiResponse(responseCode = "429", description = "Превышен лимит частоты.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @PostMapping("/leads")
    public ResponseEntity<Accepted> submit(@Valid @RequestBody LeadSubmission body,
                                           @Parameter(description = """
                                                   Ключ повторной отправки. С тем же ключом заявка \
                                                   не задваивается — вернётся расписка на уже \
                                                   принятую. Необязателен, но без него повторное \
                                                   нажатие кнопки создаёт вторую заявку.""",
                                                   example = "5a1c9f6e-77b2-4c3d-9e08-1f4a6b2c8d90")
                                           @RequestHeader(value = "Idempotency-Key", required = false) String key,
                                           HttpServletRequest request) {
        if (!rateLimit.allow(request.getRemoteAddr())) {
            throw new TooManyRequestsException("Слишком много обращений. Попробуйте позже.");
        }
        if (body.trap() != null && !body.trap().isBlank()) {
            throw new RejectedSubmissionException("Заявка не принята");
        }

        var receipt = intake.accept(new LeadIntake.Draft(
                body.form(), body.name(), body.company(), body.phone(), body.email(),
                body.productSlug(), body.serialNumber(), body.message(), "site",
                body.language(), body.campaign()), key);

        // 202, а не 201: заявка принята, дальше её разбирает менеджер.
        // Повтор с тем же Idempotency-Key вернёт тот же идентификатор.
        return ResponseEntity.accepted()
                .body(new Accepted(receipt.id(), receipt.number(), SUCCESS));
    }

    @Operation(summary = "Завести обращение из разговора",
            description = """
                    Превращает разговор в заявку: контакты приходят формой, текстом
                    обращения становится переписка, а посетитель получает номер —
                    тот же, что уйдёт ему письмом и по которому его найдёт менеджер.

                    **Почему это дверь форм, а не чата.** Заявка — запись снаружи,
                    и принимает её то место, где стоит периметр: проверка полей,
                    ловушка для ботов, лимит частоты. Четвёртой двери не заводится.
                    Здесь же сшиваются `chat` и `crm`, которые друг о друге не знают:
                    заявка приходит и без разговора, а разговор не обязан дорасти
                    до заявки.

                    **Повторное нажатие ничего не задваивает.** Ключом повтора служит
                    сам разговор, поэтому вторая отправка возвращает уже принятую
                    заявку с тем же номером: два номера на одно обращение — это
                    два обращения в глазах того, кто их называет.

                    Разговор при этом не закрывается и в очередь не встаёт: заявка —
                    результат разговора, а не его конец. Человек волен спросить
                    дальше, и отвечать ему будут в том же окне.

                    Лимит частоты общий с заявками форм — 5 обращений за 10 минут.
                    """)
    @ApiResponse(responseCode = "202", description = "Обращение принято, номер в теле ответа.")
    @ApiResponse(responseCode = "400",
            description = "Разбор по полям формы, заполненная ловушка или разговора нет.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @ApiResponse(responseCode = "429", description = "Превышен лимит частоты.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @PostMapping("/leads/from-chat")
    public ResponseEntity<Accepted> fromChat(@Valid @RequestBody ChatLeadSubmission body,
                                             HttpServletRequest request) {
        if (!rateLimit.allow(request.getRemoteAddr())) {
            throw new TooManyRequestsException("Слишком много обращений. Попробуйте позже.");
        }
        if (body.trap() != null && !body.trap().isBlank()) {
            throw new RejectedSubmissionException("Обращение не принято");
        }

        // Разговор ищется до приёма заявки, а не после: без него заявка была бы
        // принята и осталась без переписки — то есть менеджер получил бы
        // обращение «перезвоните» без вопроса, ради которого человек пришёл.
        var transcript = chat.transcriptFor(body.visitorKey())
                .orElseThrow(() -> new RejectedSubmissionException(
                        "Разговор не найден: обращение заводится из открытого чата"));

        // Ключ повтора — сам разговор. Второе нажатие кнопки в том же разговоре
        // вернёт ту же заявку и тот же номер.
        var receipt = intake.accept(new LeadIntake.Draft(
                // Консультация: тип формы в чате не выбирают, а из четырёх
                // существующих обращение из разговора — именно она.
                "consultation", body.name(), body.company(), body.phone(), body.email(),
                null, null, transcript.text(), "chat",
                body.language(), body.campaign()), "chat:" + transcript.conversationId());

        // Сообщение в ленту пишется и при повторе — точнее, не пишется:
        // разговор, у которого заявка уже есть, второй раз о ней не объявляет.
        chat.leadRaised(transcript.conversationId(), receipt.id(), receipt.number());

        return ResponseEntity.accepted()
                .body(new Accepted(receipt.id(), receipt.number(), SUCCESS));
    }
}
