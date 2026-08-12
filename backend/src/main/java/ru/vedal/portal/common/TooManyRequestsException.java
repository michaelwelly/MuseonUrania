package ru.vedal.portal.common;

// Нужен двум публичным дверям — формам и ассистенту, — поэтому лежит в common.
// Обрабатывается общим ApiExceptionHandler: обработчик, привязанный к пакету
// одного модуля, до второго не достаёт, и 429 превратился бы в 500.
public class TooManyRequestsException extends RuntimeException {

    public TooManyRequestsException(String message) {
        super(message);
    }
}
