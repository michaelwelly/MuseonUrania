package ru.vedal.portal.common;

// Тело запроса или файл больше разрешённого. Отдельный тип, а не общая ошибка:
// редактору нужно увидеть, какой предел он превысил, а не «загрузка не удалась».
public class PayloadTooLargeException extends RuntimeException {

    public PayloadTooLargeException(String message) {
        super(message);
    }
}
