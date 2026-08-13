package ru.vedal.portal.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.util.unit.DataSize;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.LinkedHashMap;
import java.util.Map;

// Один формат ошибок на все двери: application/problem+json, RFC 9457.
@RestControllerAdvice
public class ApiExceptionHandler {

    // Предел читается из настройки, а не пишется в текст руками: сообщение,
    // называющее не тот размер, хуже, чем сообщение без размера.
    private final DataSize maxFileSize;

    public ApiExceptionHandler(@Value("${vedal.storage.max-file-size:20MB}") DataSize maxFileSize) {
        this.maxFileSize = maxFileSize;
    }

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

    @ExceptionHandler(ConflictException.class)
    public ProblemDetail conflict(ConflictException e) {
        var problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        problem.setTitle(e.getMessage());
        return problem;
    }

    // Файл больше предела, пойманный уже в хранилище или в домене.
    @ExceptionHandler(PayloadTooLargeException.class)
    public ProblemDetail tooLarge(PayloadTooLargeException e) {
        var problem = ProblemDetail.forStatus(HttpStatus.PAYLOAD_TOO_LARGE);
        problem.setTitle(e.getMessage());
        return problem;
    }

    // Тот же отказ, но пойманный разбором multipart — то есть до того, как
    // тело целиком добралось до кучи. Это и есть настоящая защита от большого
    // файла; без этого обработчика она отвечает страницей ошибки контейнера,
    // и админка на фронте не может показать причину рядом с полем.
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ProblemDetail uploadTooLarge(MaxUploadSizeExceededException e) {
        var problem = ProblemDetail.forStatus(HttpStatus.PAYLOAD_TOO_LARGE);
        problem.setTitle("Файл больше разрешённого размера");
        problem.setDetail("Предел на один файл — " + maxFileSize.toMegabytes() + " МБ.");
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
