package ru.vedal.portal.gateway;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

// Только то, что специфично для этой двери. Лимит частоты общий и живёт
// в ApiExceptionHandler: он нужен и ассистенту.
@RestControllerAdvice(basePackageClasses = GatewayExceptionHandler.class)
public class GatewayExceptionHandler {

    @ExceptionHandler(RejectedSubmissionException.class)
    public ProblemDetail rejected(RejectedSubmissionException e) {
        var problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setTitle(e.getMessage());
        return problem;
    }
}
