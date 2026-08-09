package ru.vedal.portal.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

// Один формат ошибок на все двери: application/problem+json, RFC 9457.
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    public ProblemDetail notFound(NotFoundException e) {
        var problem = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        problem.setTitle(e.getMessage());
        return problem;
    }

    @ExceptionHandler(TooManyRequestsException.class)
    public ProblemDetail tooMany(TooManyRequestsException e) {
        var problem = ProblemDetail.forStatus(HttpStatus.TOO_MANY_REQUESTS);
        problem.setTitle(e.getMessage());
        return problem;
    }

    // Разбор по полям: форма на сайте должна показать ошибку рядом с полем,
    // а не одну строку «неверный запрос» над всей формой.
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail invalid(MethodArgumentNotValidException e) {
        var problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setTitle("Проверьте заполнение полей");

        Map<String, String> fields = new LinkedHashMap<>();
        for (var error : e.getBindingResult().getAllErrors()) {
            var field = error instanceof FieldError fe ? fe.getField() : error.getObjectName();
            fields.putIfAbsent(field, error.getDefaultMessage());
        }
        problem.setProperty("fields", fields);
        return problem;
    }
}
