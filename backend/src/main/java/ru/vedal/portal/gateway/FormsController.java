package ru.vedal.portal.gateway;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.vedal.portal.crm.LeadIntake;

import java.util.UUID;

// Единственная дверь на запись снаружи. Авторизации нет — дверь публичная
// по назначению, поэтому проверки здесь и есть весь периметр.
@RestController
@RequestMapping("/api/forms/v1")
public class FormsController {

    // Текст из docs/frontend/content_model.md → Lead Form Model.
    private static final String SUCCESS = "Спасибо. Специалист VEDAL свяжется с вами.";

    public record Accepted(UUID id, String message) {}

    private final LeadIntake intake;
    private final RateLimit rateLimit;

    public FormsController(LeadIntake intake, RateLimit rateLimit) {
        this.intake = intake;
        this.rateLimit = rateLimit;
    }

    @PostMapping("/leads")
    public ResponseEntity<Accepted> submit(@Valid @RequestBody LeadSubmission body,
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
                body.productSlug(), body.message(), "site"), key);

        // 202, а не 201: заявка принята, дальше её разбирает менеджер.
        // Повтор с тем же Idempotency-Key вернёт тот же идентификатор.
        return ResponseEntity.accepted().body(new Accepted(receipt.id(), SUCCESS));
    }
}
