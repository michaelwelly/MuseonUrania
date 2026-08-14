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

            @Schema(description = "Текст для показа посетителю.",
                    example = "Спасибо. Специалист VEDAL свяжется с вами.")
            String message) {}

    private final LeadIntake intake;
    private final RateLimit rateLimit;

    public FormsController(LeadIntake intake, @Qualifier("formsRateLimit") RateLimit rateLimit) {
        this.intake = intake;
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
                body.productSlug(), body.message(), "site",
                body.language(), body.campaign()), key);

        // 202, а не 201: заявка принята, дальше её разбирает менеджер.
        // Повтор с тем же Idempotency-Key вернёт тот же идентификатор.
        return ResponseEntity.accepted().body(new Accepted(receipt.id(), SUCCESS));
    }
}
