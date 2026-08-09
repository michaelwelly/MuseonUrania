package ru.vedal.portal.assistant;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.vedal.portal.common.RateLimit;
import ru.vedal.portal.common.TooManyRequestsException;

@RestController
@RequestMapping("/api/assistant/v1")
public class PublicAssistantController {

    private final AssistantService assistant;
    private final RateLimit rateLimit;

    public PublicAssistantController(AssistantService assistant,
                                     @Qualifier("assistantRateLimit") RateLimit rateLimit) {
        this.assistant = assistant;
        this.rateLimit = rateLimit;
    }

    @PostMapping("/ask")
    public ResponseEntity<AskReply> ask(@Valid @RequestBody AskRequest request,
                                        HttpServletRequest http) {
        if (!rateLimit.allow(http.getRemoteAddr())) {
            throw new TooManyRequestsException("Слишком много вопросов подряд. Попробуйте позже.");
        }
        return ResponseEntity.ok(assistant.ask(request.question()));
    }
}
