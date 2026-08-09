package ru.vedal.portal.gateway;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

// Ошибки двери в том же формате, что и у остальных: application/problem+json.
// Лежит в gateway, а не в common: common не должен знать про соседние модули.
@RestControllerAdvice(basePackageClasses = GatewayExceptionHandler.class)
public class GatewayExceptionHandler {

    @ExceptionHandler(TooManyRequestsException.class)
    public ProblemDetail tooMany(TooManyRequestsException e) {
        var problem = ProblemDetail.forStatus(HttpStatus.TOO_MANY_REQUESTS);
        problem.setTitle(e.getMessage());
        return problem;
    }

    @ExceptionHandler(RejectedSubmissionException.class)
    public ProblemDetail rejected(RejectedSubmissionException e) {
        var problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setTitle(e.getMessage());
        return problem;
    }
}
